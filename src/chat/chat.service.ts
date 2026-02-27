import { Injectable, Logger } from '@nestjs/common';
import { FaqService } from '../faq/faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { LlmService } from '../llm/llm.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ContextRewriterService } from '../conversation/context-rewriter.service';
import { RouteType } from '../types/routes';

// Hard cap for conversation history to prevent unbounded memory per session
const MAX_HISTORY_LENGTH = 20;

export interface ConversationMessage {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private faqService: FaqService,
    private embeddingService: EmbeddingService,
    private llmService: LlmService,
    private supabaseService: SupabaseService,
    private contextRewriter: ContextRewriterService,
  ) {}

  /**
   * Retrieve the last N messages from a session
   */
  async getConversationHistory(
    sessionId: string,
    limit: number = 10,
  ): Promise<ConversationMessage[]> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, returning empty history');
        return [];
      }
      
      // Enforce hard cap to prevent unbounded memory per session
      const cappedLimit = Math.min(limit, MAX_HISTORY_LENGTH);
      
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(cappedLimit);

      if (error) {
        this.logger.warn(
          `Failed to load conversation history: ${error.message}`,
        );
        return [];
      }

      return (data || []).reverse(); // Reverse to get chronological order
    } catch (err) {
      this.logger.warn('Error loading conversation history:', err);
      return [];
    }
  }

  /**
   * Save a message to the conversation_messages table
   */
  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<ConversationMessage | null> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, skipping message save');
        return null;
      }
      
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          role,
          content,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to save message: ${error.message}`);
        return null;
      }
      return data as ConversationMessage;
    } catch (err) {
      this.logger.error('Error saving message:', err);
      return null;
    }
  }

  /**
   * Process a chat message: retrieve history, rewrite query, search FAQ, and save messages
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<{
    answer: string;
    route: string;
    confidence: number;
    sessionId: string;
    llmUsed: boolean;
    queryLogId: number | null;
    topResult: { question: string; category: string } | null;
  }> {
    if (!userMessage || userMessage.trim().length === 0) {
      return {
        answer: 'Please provide a message.',
        route: RouteType.ERROR,
        confidence: 0,
        sessionId,
        llmUsed: false,
        queryLogId: null,
        topResult: null,
      };
    }

    const start = Date.now();

    try {
      // 1. Retrieve conversation history (with hard cap enforced)
      const conversationHistory = await this.getConversationHistory(
        sessionId,
        5,
      );

      // 2. Build context string from history
      const historyStrings = conversationHistory
        .map(
          (msg) =>
            `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
        )
        .join('\n');

      // 3. Rewrite query with context
      const rewrittenQuery = this.contextRewriter.rewriteWithContext(
        userMessage,
        conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at || new Date()),
        })),
      );
      const contextUsed = rewrittenQuery !== userMessage;

      // Generate embedding and search
      const embedding = await this.embeddingService.generate(rewrittenQuery);
      const results = await this.faqService.searchByVector(embedding, 0.5, 3);

      const responseTime = Date.now() - start;

      let route = RouteType.FALLBACK;
      let topFaqId: number | null = null;
      let similarity: number | null = null;
      let queryLogId: number | null = null;
      let answer: string;
      let llmUsed = false;

      const topResult = results.length > 0 ? results[0] : null;

      // 3-TIER ROUTING LOGIC
      if (topResult && topResult.similarity >= 0.8) {
        // HIGH confidence - direct FAQ answer
        route = RouteType.DIRECT;
        answer = topResult.answer;
        similarity = Math.round(topResult.similarity * 100);
        topFaqId = Number(topResult.id);
      } else if (topResult && topResult.similarity >= 0.5) {
        // MEDIUM confidence - use LLM to synthesize
        route = RouteType.LLM_SYNTHESIS;
        similarity = Math.round(topResult.similarity * 100);
        topFaqId = Number(topResult.id);

        const faqContext = results
          .filter((r) => r.similarity >= 0.4)
          .map((r) => ({
            question: r.question,
            answer: r.answer,
            similarity: r.similarity,
          }));

        const synthesized = await this.llmService.synthesizeAnswer(
          userMessage,
          faqContext,
          historyStrings ? [historyStrings] : undefined,
        );

        if (synthesized) {
          answer = synthesized;
          llmUsed = true;
        } else {
          // LLM failed, fall back to best FAQ
          answer = topResult.answer;
          route = RouteType.DIRECT_FALLBACK;
        }
      } else {
        // LOW confidence - graceful fallback
        route = RouteType.FALLBACK;
        answer =
          "I'm not sure about that specific question. " +
          'You can contact our support team at support@example.com ' +
          'or try rephrasing your question.';
      }

      // Log the query
      queryLogId = await this.faqService.logQuery(
        userMessage,
        topFaqId,
        similarity,
        route,
        responseTime,
        llmUsed,
        contextUsed,
        topResult?.category,
      );

      // Save both messages to persistent storage
      await this.saveMessage(sessionId, 'user', userMessage);
      await this.saveMessage(sessionId, 'assistant', answer);

      return {
        answer,
        route,
        confidence: similarity || 0,
        sessionId,
        llmUsed,
        queryLogId,
        topResult: topResult
          ? {
              question: topResult.question,
              category: topResult.category,
            }
          : null,
      };
    } catch (error) {
      this.logger.error('Error processing chat message:', error);
      return {
        answer: 'An error occurred processing your message. Please try again.',
        route: RouteType.ERROR,
        confidence: 0,
        sessionId,
        llmUsed: false,
        queryLogId: null,
        topResult: null,
      };
    }
  }
}


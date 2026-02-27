import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { FaqResult } from '../types';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Get answer for a question using vector search
   * This is a simplified version used by the /api/faq endpoint
   */
  async getAnswer(question: string, _history: any[] = []): Promise<string> {
    try {
      // For now, return a simple response
      // In a full implementation, this would generate embeddings and search
      const supabase = this.supabaseService.getClient();

      if (!supabase) {
        return "I'm not sure about that. Please configure Supabase to enable FAQ responses.";
      }

      // Simple keyword search as fallback
      const results = await this.searchByKeyword(question, 3);

      if (results && results.length > 0) {
        return results[0].answer;
      }

      return "I'm not sure about that specific question. You can contact our support team or try rephrasing your question.";
    } catch (error) {
      this.logger.error(`Error getting answer: ${error}`);
      return "I'm having trouble answering your question right now. Please try again later.";
    }
  }

  async searchByVector(
    embedding: number[],
    threshold = 0.5,
    limit = 3,
  ): Promise<FaqResult[]> {
    try {
      const supabase = this.supabaseService.getClient();

      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, returning empty results');
        return [];
      }

      this.logger.debug('Calling RPC match_faqs with embedding', {
        embeddingLength: embedding?.length,
        threshold,
        limit,
      });

      const { data, error } = await supabase.rpc('match_faqs', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        this.logger.error('RPC match_faqs error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        // Check for specific error types
        if (
          error.message?.includes('does not exist') ||
          error.code === 'PGRST116'
        ) {
          this.logger.error(
            'RPC function match_faqs does not exist in database. Please create the function.',
          );
        }

        return [];
      }

      this.logger.debug('RPC match_faqs successful', {
        resultCount: data?.length,
      });
      return (data as FaqResult[]) || [];
    } catch (err) {
      this.logger.error('Unexpected error in searchByVector:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      });
      return [];
    }
  }

  async searchByKeyword(query: string, limit = 3): Promise<FaqResult[]> {
    try {
      const supabase = this.supabaseService.getClient();

      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, returning empty results');
        return [];
      }

      const sanitizedQuery = query.replace(/[%_]/g, '\\$&'); // Escape SQL wildcards
      const { data, error } = await supabase
        .from('faq')
        .select('id, question, answer, category')
        .ilike('question', `%${sanitizedQuery}%`)
        .limit(limit);
      if (error) {
        this.logger.error('Keyword search failed:', error.message);
        return [];
      }
      return (data as FaqResult[]) || [];
    } catch (err) {
      this.logger.error('Unexpected error in searchByKeyword:', err);
      return [];
    }
  }

  async logQuery(
    queryText: string,
    topFaqId: number | null,
    similarityScore: number | null,
    routeDecision: string,
    responseTimeMs: number,
    llmUsed: boolean = false,
    contextUsed: boolean = false,
    matchedFaqCategory?: string,
  ): Promise<number | null> {
    try {
      const supabase = this.supabaseService.getClient();

      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, skipping query log');
        return null;
      }

      const crypto = await import('crypto');
      const queryHash = crypto
        .createHash('md5')
        .update(queryText.toLowerCase().trim())
        .digest('hex');

      const { data, error } = await supabase
        .from('query_logs')
        .insert({
          query_text: queryText,
          query_hash: queryHash,
          top_faq_id: topFaqId,
          similarity_score: similarityScore,
          route_decision: routeDecision,
          response_time_ms: responseTimeMs,
          llm_used: llmUsed,
          context_used: contextUsed,
          matched_faq_category: matchedFaqCategory || null,
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error('Failed to log query:', error.message);
        return null;
      }

      return data?.id ?? null;
    } catch (err) {
      this.logger.error('Failed to log query:', err);
      return null;
    }
  }

  async saveFeedback(
    queryLogId: number,
    helpful: number,
    rating?: number,
    feedback?: string,
    feedbackType?: string,
  ) {
    try {
      const supabase = this.supabaseService.getClient();

      // Handle case where Supabase is not initialized
      if (!supabase) {
        this.logger.warn('Supabase not initialized, skipping feedback save');
        return;
      }

      const updateData: Record<string, unknown> = {
        helpful,
      };

      if (rating !== undefined && rating >= 1 && rating <= 5) {
        updateData.rating = rating;
      }

      const cleanFeedback = feedback?.trim();
      if (cleanFeedback && cleanFeedback.length > 0) {
        updateData.feedback_text = cleanFeedback;
      }

      if (
        feedbackType &&
        [
          'accurate',
          'incomplete',
          'unclear',
          'irrelevant',
          'outdated',
        ].includes(feedbackType)
      ) {
        updateData.feedback_type = feedbackType;
      }

      const { error } = await supabase
        .from('query_logs')
        .update(updateData)
        .eq('id', queryLogId);

      if (error) {
        this.logger.error('Failed to save feedback:', error.message);
        return;
      }

      this.logger.debug(`Feedback saved for query ${queryLogId}`);
    } catch (err) {
      this.logger.error('Failed to save feedback:', err);
    }
  }
}

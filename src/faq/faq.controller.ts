import { Controller, Post, Body, Get, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { v4 as uuidv4 } from 'uuid';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SearchDto } from './dto/search.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ConversationService } from '../conversation/conversation.service';
import { LlmService } from '../llm/llm.service';

@Controller()
export class FaqController {
  private readonly logger = new Logger(FaqController.name);

  constructor(
    private faqService: FaqService,
    private embeddingService: EmbeddingService,
    private conversationService: ConversationService,
    private llmService: LlmService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date() };
  }

  @Post('search')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 searches per minute
  async search(@Body() dto: SearchDto) {
    const query = dto.query;
    if (!query || query.trim().length === 0) {
      return { error: 'Query is required' };
    }

    // TEMPORARILY DISABLED - ConversationService causing crashes
    // let sessionId = dto.sessionId;
    // if (!sessionId) {
    //   sessionId = await this.conversationService.createSession();
    // }
    // const history = this.conversationService.getRecentContext(sessionId);
    // const rewrittenQuery = this.contextRewriter.rewriteWithContext(dto.query, history);

    // Use original query without context for now
    const rewrittenQuery = dto.query;
    const history: any[] = [];
    let sessionId = dto.sessionId || uuidv4();
    const contextUsed = false;

    const start = Date.now();

    try {
      // Generate embedding
      const embedding = await this.embeddingService.generate(rewrittenQuery);
      const results = await this.faqService.searchByVector(embedding, 0.5, 3);

      const responseTime = Date.now() - start;

      let route = 'fallback';
      let topFaqId: number | null = null;
      let similarity: number | null = null;
      let queryLogId: number | null = null;
      let answer: string;
      let llmUsed = false;

      const topResult = results.length > 0 ? results[0] : null;

      // 3-TIER ROUTING LOGIC
      if (topResult && topResult.similarity >= 0.8) {
        // HIGH confidence - direct FAQ answer
        route = 'direct';
        answer = topResult.answer;
        similarity = Math.round(topResult.similarity * 100);
        topFaqId = topResult.id;
      } else if (topResult && topResult.similarity >= 0.5) {
        // MEDIUM confidence - use LLM to synthesize
        route = 'llm_synthesis';
        similarity = Math.round(topResult.similarity * 100);
        topFaqId = topResult.id;

        const faqContext = results
          .filter((r) => r.similarity >= 0.4)
          .map((r) => ({
            question: r.question,
            answer: r.answer,
            similarity: r.similarity,
          }));

        const historyStrings = history.map((m) => `${m.role}: ${m.content}`);

        const synthesized = await this.llmService.synthesizeAnswer(
          query,
          faqContext,
          historyStrings,
        );

        if (synthesized) {
          answer = synthesized;
          llmUsed = true;
        } else {
          // LLM failed, fall back to best FAQ
          answer = topResult.answer;
          route = 'direct_fallback';
        }
      } else {
        // LOW confidence - graceful fallback
        route = 'fallback';
        answer =
          "I'm not sure about that specific question. " +
          'You can contact our support team at support@example.com ' +
          'or try rephrasing your question.';
      }

      // Log the query
      queryLogId = await this.faqService.logQuery(
        query,
        topFaqId,
        similarity,
        route,
        responseTime,
        llmUsed,
        contextUsed,
        topResult?.category,
      );

      // Store the exchange in session (fire and forget - don't fail the request if this fails)
      try {
        await this.conversationService.addMessage(sessionId, 'user', query);
        await this.conversationService.addMessage(sessionId, 'assistant', answer);
      } catch (msgError) {
        this.logger.warn('Failed to store conversation message:', msgError);
        // Continue - this is not critical
      }

      return {
        answer,
        route,
        confidence: similarity || 0,
        sessionId,
        contextUsed,
        rewrittenQuery: contextUsed ? rewrittenQuery : undefined,
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
      // Model not ready or other error
      return {
        route: 'error',
        message: 'Search is starting up, please try again in a moment.',
        error: error.message,
        sessionId,
      };
    }
  }

  @Post('feedback')
  async feedback(@Body() dto: FeedbackDto) {
    await this.faqService.saveFeedback(
      dto.queryLogId,
      dto.helpful,
      dto.rating,
      dto.feedback,
      dto.feedbackType,
    );
    return { success: true };
  }
}

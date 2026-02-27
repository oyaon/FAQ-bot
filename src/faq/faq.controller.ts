import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SearchDto } from './dto/search.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { LlmService } from '../llm/llm.service';
import { RouteType } from '../types/routes';

@Controller()
export class FaqController {
  private readonly logger = new Logger(FaqController.name);

  constructor(
    private faqService: FaqService,
    private embeddingService: EmbeddingService,
    private supabaseService: SupabaseService,
    private llmService: LlmService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    const embeddingReady = this.embeddingService.isReady();
    const supabaseReady = await this.supabaseService.isReady();

    if (!embeddingReady || !supabaseReady) {
      return {
        status: 'degraded',
        embedding: embeddingReady,
        supabase: supabaseReady,
        timestamp: new Date(),
      };
    }

    return {
      status: 'ok',
      embedding: true,
      supabase: true,
      timestamp: new Date(),
    };
  }

  @Post('search')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 searches per minute
  async search(@Body() dto: SearchDto) {
    const query = dto.query;
    if (!query || query.trim().length === 0) {
      return { error: 'Query is required' };
    }

    // CONVERSATION MEMORY TEMPORARILY DISABLED
    // let sessionId = dto.sessionId;
    // if (!sessionId) {
    //   sessionId = this.conversationService.createSession();
    // }
    // const history = this.conversationService.getRecentContext(sessionId);
    // const rewrittenQuery = this.contextRewriter.rewriteWithContext(dto.query, history);

    // Use query directly without context rewriting
    const historyStrings: string[] = [];
    const contextUsed = false;

    const start = Date.now();

    try {
      // Generate embedding
      const embedding = await this.embeddingService.generate(query);
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
        query,
        topFaqId,
        similarity,
        route,
        responseTime,
        llmUsed,
        contextUsed,
        topResult?.category,
      );

      return {
        answer,
        route,
        confidence: similarity || 0,
        // sessionId removed - conversation memory disabled
        contextUsed,
        // rewrittenQuery removed - conversation memory disabled
        llmUsed,
        queryLogId,
        topResult: topResult
          ? {
              question: topResult.question,
              category: topResult.category,
            }
          : null,
      };
    } catch (error: unknown) {
      // Model not ready or other error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        route: RouteType.ERROR,
        message: 'Search is starting up, please try again in a moment.',
        error: errorMessage,
        // sessionId removed - conversation memory disabled
      };
    }
  }

  @Post('feedback')
  async feedback(@Body() dto: FeedbackDto) {
    await this.faqService.saveFeedback(
      dto.queryLogId,
      dto.helpful ? 1 : 0, // Convert boolean to number for database
      dto.rating,
      dto.feedback,
      dto.feedbackType,
    );
    return { success: true };
  }
}

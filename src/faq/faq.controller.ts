import { Controller, Post, Body, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SearchDto } from './dto/search.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { ConversationService } from '../conversation/conversation.service';
import { ContextRewriterService } from '../conversation/context-rewriter.service';

@Controller()
export class FaqController {
  constructor(
    private faqService: FaqService,
    private embeddingService: EmbeddingService,
    private conversationService: ConversationService,
    private contextRewriter: ContextRewriterService,
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

    // 1. Get or create session
    let sessionId = dto.sessionId;
    if (!sessionId) {
      sessionId = this.conversationService.createSession();
    }

    // 2. Get conversation history
    const history = this.conversationService.getRecentContext(sessionId);

    // 3. Rewrite query with context if needed
    const rewrittenQuery = this.contextRewriter.rewriteWithContext(
      query,
      history,
    );
    const contextUsed = rewrittenQuery !== query;

    const start = Date.now();

    try {
      // Generate embedding (now with error handling)
      const embedding = await this.embeddingService.generate(rewrittenQuery);
      const results = await this.faqService.searchByVector(embedding, 0.5, 3);

      const responseTime = Date.now() - start;

      let route = 'fallback';
      let topFaqId: number | null = null;
      let similarity: number | null = null;
      let queryLogId: number | null = null;

      if (results.length > 0) {
        const best = results[0];
        similarity = Math.round(best.similarity * 100);
        topFaqId = best.id;

        if (similarity >= 75) {
          route = 'direct';
          queryLogId = await this.faqService.logQuery(
            query,
            topFaqId,
            similarity,
            route,
            responseTime,
          );
          
          // 5. Store the exchange in session
          this.conversationService.addMessage(sessionId, 'user', query);
          this.conversationService.addMessage(sessionId, 'assistant', best.answer);

          return {
            route: 'direct',
            similarity,
            answer: best.answer,
            question: best.question,
            category: best.category,
            results: [best],
            queryLogId,
            sessionId,
            contextUsed,
            rewrittenQuery: contextUsed ? rewrittenQuery : undefined,
          };
        } else if (similarity >= 50) {
          route = 'suggestions';
        }
      }

      queryLogId = await this.faqService.logQuery(
        query,
        topFaqId,
        similarity,
        route,
        responseTime,
      );

      // 5. Store the exchange in session
      this.conversationService.addMessage(sessionId, 'user', query);
      const resultsSummary = results.length > 0 
        ? results.map(r => r.question).join(' | ')
        : 'No results found';
      this.conversationService.addMessage(sessionId, 'assistant', resultsSummary);

      return {
        route,
        similarity,
        results,
        queryLogId,
        sessionId,
        contextUsed,
        rewrittenQuery: contextUsed ? rewrittenQuery : undefined,
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
    await this.faqService.saveFeedback(dto.queryLogId, dto.helpful);
    return { success: true };
  }
}
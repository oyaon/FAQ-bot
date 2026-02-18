import { Controller, Post, Body, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SearchDto } from './dto/search.dto';
import { FeedbackDto } from './dto/feedback.dto';

@Controller()
export class FaqController {
  constructor(
    private faqService: FaqService,
    private embeddingService: EmbeddingService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date() };
  }

  @Post('search')
  async search(@Body() dto: SearchDto) {
    const query = dto.query;
    if (!query || query.trim().length === 0) {
      return { error: 'Query is required' };
    }

    const start = Date.now();

    try {
      // Generate embedding (now with error handling)
      const embedding = await this.embeddingService.generate(query);
      const results = await this.faqService.searchByVector(embedding, 0.5, 3);

      const responseTime = Date.now() - start;

      let route = 'fallback';
      let topFaqId: number | null = null;
      let similarity: number | null = null;

      if (results.length > 0) {
        const best = results[0];
        similarity = Math.round(best.similarity * 100);
        topFaqId = best.id;

        if (similarity >= 75) {
          route = 'direct';
          await this.faqService.logQuery(
            query,
            topFaqId,
            similarity,
            route,
            responseTime,
          );
          return {
            route: 'direct',
            similarity,
            answer: best.answer,
            question: best.question,
            category: best.category,
            results: [best],
          };
        } else if (similarity >= 50) {
          route = 'suggestions';
        }
      }

      await this.faqService.logQuery(
        query,
        topFaqId,
        similarity,
        route,
        responseTime,
      );

      return {
        route,
        similarity,
        results,
      };
    } catch (error) {
      // Model not ready or other error
      return {
        route: 'error',
        message: 'Search is starting up, please try again in a moment.',
        error: error.message,
      };
    }
  }

  @Post('feedback')
  async feedback(@Body() dto: FeedbackDto) {
    await this.faqService.saveFeedback(dto.queryLogId, dto.helpful);
    return { success: true };
  }
}
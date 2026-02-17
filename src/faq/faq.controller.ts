import { Controller, Post, Body, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SearchDto } from './dto/search.dto';

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
  async search(@Body() body: SearchDto) {
    const start = Date.now();

    const embedding = await this.embeddingService.generateEmbedding(body.query);
    const results = await this.faqService.searchByVector(embedding, 0.5, 3);

    const responseTime = Date.now() - start;

    let route = 'fallback';
    let topFaqId: number | null = null;
    let similarity: number | null = null;

    if (results.length > 0) {
      similarity = Math.round(results[0].similarity * 100);
      topFaqId = results[0].id;

      if (similarity >= 75) {
        route = 'direct';
      } else if (similarity >= 50) {
        route = 'suggestions';
      }
    }

    await this.faqService.logQuery(
      body.query,
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
  }

  @Post('feedback')
  async feedback(
    @Body('queryLogId') queryLogId: number,
    @Body('helpful') helpful: boolean,
  ) {
    await this.faqService.saveFeedback(queryLogId, helpful);
    return { success: true };
  }
}
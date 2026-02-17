import { Controller, Post, Body, Get } from '@nestjs/common';
import { FaqService } from './faq.service';
import { EmbeddingService } from '../embedding/embedding.service';

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
  async search(@Body('query') query: string) {
    if (!query || query.trim().length === 0) {
      return { error: 'Query is required' };
    }

    const startTime = Date.now();

    // Step 1: Try keyword search first (fast)
    const keywordResults = await this.faqService.searchByKeyword(query);

    // Step 2: Always do vector search for semantic matching
    const embedding = await this.embeddingService.generate(query);
    const vectorResults = await this.faqService.searchByVector(embedding);

    // Step 3: Merge results (vector results are primary)
    const results = vectorResults.length > 0 ? vectorResults : keywordResults;

    const responseTimeMs = Date.now() - startTime;

    // Step 4: Confidence-based routing
    if (results.length === 0) {
      await this.faqService.logQuery(query, null, null, 'fallback', responseTimeMs);
      return {
        route: 'fallback',
        answer: null,
        message: "I couldn't find an answer to your question. Please contact our support team.",
        results: [],
      };
    }

    const best = results[0];
    const similarity = best.similarity ?? 0;

    // High confidence → single direct answer
    if (similarity > 0.75) {
      await this.faqService.logQuery(query, best.id, similarity, 'direct', responseTimeMs);
      return {
        route: 'direct',
        similarity: Math.round(similarity * 100),
        answer: best.answer,
        question: best.question,
        category: best.category,
        results: [best],
      };
    }

    // Medium confidence → show top matches
    if (similarity > 0.5) {
      await this.faqService.logQuery(query, best.id, similarity, 'suggestions', responseTimeMs);
      return {
        route: 'suggestions',
        similarity: Math.round(similarity * 100),
        answer: null,
        message: 'Here are the closest answers I found:',
        results: results.slice(0, 3),
      };
    }

    // Low confidence → fallback
    await this.faqService.logQuery(query, best.id, similarity, 'fallback', responseTimeMs);
    return {
      route: 'fallback',
      answer: null,
      message: "I'm not confident I have the right answer. Please contact our support team.",
      results: results.slice(0, 2),
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
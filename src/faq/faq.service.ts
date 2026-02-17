import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
this.supabase = createClient(
  this.configService.get<string>('SUPABASE_URL')!,
  this.configService.get<string>('SUPABASE_ANON_KEY')!,
);
  }

  async searchByVector(embedding: number[], threshold = 0.5, limit = 3) {
    try {
      const { data, error } = await this.supabase.rpc('match_faq', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
      });
      if (error) {
        this.logger.error('Vector search failed:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      this.logger.error('Unexpected error in searchByVector:', err);
      return [];
    }
  }

  async searchByKeyword(query: string, limit = 3) {
    try {
      const { data, error } = await this.supabase
        .from('faq')
        .select('id, question, answer, category')
        .ilike('question', `%${query}%`)
        .limit(limit);
      if (error) {
        this.logger.error('Keyword search failed:', error.message);
        return [];
      }
      return data || [];
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
  ) {
    try {
      const crypto = await import('crypto');
      const queryHash = crypto
        .createHash('md5')
        .update(queryText.toLowerCase().trim())
        .digest('hex');

      await this.supabase.from('query_logs').insert({
        query_text: queryText,
        query_hash: queryHash,
        top_faq_id: topFaqId,
        similarity_score: similarityScore,
        route_decision: routeDecision,
        response_time_ms: responseTimeMs,
      });
    } catch (err) {
      this.logger.error('Failed to log query:', err);
    }
  }

  async saveFeedback(queryLogId: number, helpful: boolean) {
    try {
      await this.supabase
        .from('query_logs')
        .update({ feedback: helpful })
        .eq('id', queryLogId);
    } catch (err) {
      this.logger.error('Failed to save feedback:', err);
    }
  }
}
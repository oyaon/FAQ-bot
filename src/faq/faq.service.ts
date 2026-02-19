import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {}

  async searchByVector(embedding: number[], threshold = 0.5, limit = 3) {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.rpc('match_faq', {
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
      const supabase = this.supabaseService.getClient();
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
  ): Promise<number | null> {
    try {
      const supabase = this.supabaseService.getClient();
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

  async saveFeedback(queryLogId: number, helpful: boolean) {
    try {
      const supabase = this.supabaseService.getClient();
      await supabase
        .from('query_logs')
        .update({ feedback: helpful })
        .eq('id', queryLogId);
    } catch (err) {
      this.logger.error('Failed to save feedback:', err);
    }
  }
}

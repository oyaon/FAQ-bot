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
    llmUsed: boolean = false,
    contextUsed: boolean = false,
    matchedFaqCategory?: string,
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
    helpful: boolean,
    rating?: number,
    feedback?: string,
    feedbackType?: string,
  ) {
    try {
      const supabase = this.supabaseService.getClient();
      const updateData: any = {
        feedback: helpful,
      };

      if (rating !== undefined && rating >= 1 && rating <= 5) {
        updateData.rating = rating;
      }

      if (feedback && feedback.trim().length > 0) {
        updateData.feedback_text = feedback;
      }

      if (feedbackType) {
        updateData.feedback_type = feedbackType;
      }

      await supabase
        .from('query_logs')
        .update(updateData)
        .eq('id', queryLogId);

      this.logger.log(`Feedback saved for query log ${queryLogId}`);
    } catch (err) {
      this.logger.error('Failed to save feedback:', err);
    }
  }
}

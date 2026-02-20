import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface QueryAnalytics {
  totalQueries: number;
  averageConfidence: number;
  routeBreakdown: {
    direct: number;
    llm_synthesis: number;
    direct_fallback: number;
    fallback: number;
    error: number;
  };
  averageResponseTime: number;
  topQueries: Array<{ query: string; count: number; avgConfidence: number }>;
  categoryDistribution: Record<string, number>;
  feedbackRating: { helpful: number; unhelpful: number; percentage: number };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private supabaseService: SupabaseService) {}

  async getAnalytics(days: number = 7): Promise<QueryAnalytics | null> {
    try {
      const supabase = this.supabaseService.getClient();
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get all query logs from the past N days
      const { data: queryLogs, error: logsError } = await supabase
        .from('query_logs')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (logsError) {
        this.logger.error('Failed to fetch query logs:', logsError.message);
        return null;
      }

      if (!queryLogs || queryLogs.length === 0) {
        return {
          totalQueries: 0,
          averageConfidence: 0,
          routeBreakdown: {
            direct: 0,
            llm_synthesis: 0,
            direct_fallback: 0,
            fallback: 0,
            error: 0,
          },
          averageResponseTime: 0,
          topQueries: [],
          categoryDistribution: {},
          feedbackRating: { helpful: 0, unhelpful: 0, percentage: 0 },
        };
      }

      // Route breakdown
      const routeBreakdown = {
        direct: queryLogs.filter(q => q.route_decision === 'direct').length,
        llm_synthesis: queryLogs.filter(q => q.route_decision === 'llm_synthesis')
          .length,
        direct_fallback: queryLogs.filter(q => q.route_decision === 'direct_fallback')
          .length,
        fallback: queryLogs.filter(q => q.route_decision === 'fallback').length,
        error: queryLogs.filter(q => q.route_decision === 'error').length,
      };

      // Confidence stats
      const validConfidences = queryLogs
        .filter(q => q.similarity_score !== null)
        .map(q => q.similarity_score);
      const averageConfidence =
        validConfidences.length > 0
          ? Math.round(
              (validConfidences.reduce((a, b) => a + b, 0) /
                validConfidences.length) *
                100,
            ) / 100
          : 0;

      // Response time
      const validResponseTimes = queryLogs
        .filter(q => q.response_time_ms !== null)
        .map(q => q.response_time_ms);
      const averageResponseTime =
        validResponseTimes.length > 0
          ? Math.round(
              validResponseTimes.reduce((a, b) => a + b, 0) /
                validResponseTimes.length,
            )
          : 0;

      // Top queries (by frequency)
      const queryMap = new Map<string, { count: number; confidences: number[] }>();
      queryLogs.forEach(log => {
        const key = log.query_text?.toLowerCase().trim() || 'unknown';
        if (!queryMap.has(key)) {
          queryMap.set(key, { count: 0, confidences: [] });
        }
        const entry = queryMap.get(key);
        if (entry) {
          entry.count++;
          if (log.similarity_score !== null) {
            entry.confidences.push(log.similarity_score);
          }
        }
      });

      const topQueries = Array.from(queryMap.entries())
        .map(([query, data]) => ({
          query,
          count: data.count,
          avgConfidence:
            data.confidences.length > 0
              ? Math.round(
                  (data.confidences.reduce((a, b) => a + b, 0) /
                    data.confidences.length) *
                    100,
                ) / 100
              : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Category distribution (from FAQ matches)
      const categoryMap = new Map<string, number>();
      for (const log of queryLogs) {
        if (log.top_faq_id) {
          const { data: faq } = await supabase
            .from('faq')
            .select('category')
            .eq('id', log.top_faq_id)
            .single();

          if (faq) {
            const cat = faq.category;
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
          }
        }
      }

      const categoryDistribution = Object.fromEntries(categoryMap);

      // Feedback stats
      const withFeedback = queryLogs.filter(q => q.feedback !== null);
      const helpful = withFeedback.filter(q => q.feedback === true).length;
      const unhelpful = withFeedback.filter(q => q.feedback === false).length;
      const feedbackPercentage =
        withFeedback.length > 0
          ? Math.round((helpful / withFeedback.length) * 100)
          : 0;

      return {
        totalQueries: queryLogs.length,
        averageConfidence,
        routeBreakdown,
        averageResponseTime,
        topQueries,
        categoryDistribution,
        feedbackRating: {
          helpful,
          unhelpful,
          percentage: feedbackPercentage,
        },
      };
    } catch (error) {
      this.logger.error('Error calculating analytics:', error.message);
      return null;
    }
  }

  async getQueryStats(category?: string, days: number = 7) {
    try {
      const supabase = this.supabaseService.getClient();
      const since = new Date();
      since.setDate(since.getDate() - days);

      let query = supabase
        .from('query_logs')
        .select('route_decision, similarity_score, response_time_ms, feedback')
        .gte('created_at', since.toISOString());

      if (category) {
        // Filter by category (would need to join with FAQ table)
        // For now, this is a placeholder for future enhancement
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to fetch stats:', error.message);
        return null;
      }

      return {
        totalCount: data.length,
        successRate:
          Math.round(
            ((data.filter(q => q.route_decision !== 'error').length / data.length) *
              100) *
              100,
          ) / 100,
        averageResponseMs:
          data.length > 0
            ? Math.round(
                data.reduce((sum, q) => sum + (q.response_time_ms || 0), 0) /
                  data.length,
              )
            : 0,
        feedbackSubmitted: data.filter(q => q.feedback !== null).length,
        feedbackPercentage:
          data.length > 0
            ? Math.round(
                (data.filter(q => q.feedback !== null).length / data.length) * 100,
              )
            : 0,
      };
    } catch (error) {
      this.logger.error('Error getting query stats:', error.message);
      return null;
    }
  }
}

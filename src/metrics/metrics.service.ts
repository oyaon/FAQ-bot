import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RouteType } from '../types/routes';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getSummary() {
    const client = this.supabaseService.getClient();
    if (!client) {
      return {
        totalQueries: 0,
        avgSimilarity: 0,
        routeBreakdown: {},
      };
    }

    try {
      // Get total count
      const { count: totalQueries } = await client
        .from('query_logs')
        .select('*', { count: 'exact', head: true });

      // Get average similarity
      const { data: similarityData } = await client
        .from('query_logs')
        .select('similarity');

      const avgSimilarity = similarityData && similarityData.length > 0
        ? similarityData.reduce((sum, row) => sum + (row.similarity || 0), 0) / similarityData.length
        : 0;

      // Get route breakdown
      const { data: routeData } = await client
        .from('query_logs')
        .select('route');

      const routeBreakdown: Record<string, number> = {};
      if (routeData) {
        for (const row of routeData) {
          const route = row.route || 'unknown';
          routeBreakdown[route] = (routeBreakdown[route] || 0) + 1;
        }
      }

      return {
        totalQueries: totalQueries || 0,
        avgSimilarity: Math.round(avgSimilarity * 100) / 100,
        routeBreakdown,
      };
    } catch (error) {
      this.logger.error('Error getting summary:', error);
      return {
        totalQueries: 0,
        avgSimilarity: 0,
        routeBreakdown: {},
      };
    }
  }

  async getTopQueries(limit: number) {
    const client = this.supabaseService.getClient();
    if (!client) {
      return [];
    }

    try {
      const { data } = await client
        .from('query_logs')
        .select('query_text');

      if (!data) return [];

      // Group by query text
      const queryCounts: Record<string, number> = {};
      for (const row of data) {
        const query = row.query_text || '';
        queryCounts[query] = (queryCounts[query] || 0) + 1;
      }

      // Convert to array and sort
      const sorted = Object.entries(queryCounts)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      this.logger.error('Error getting top queries:', error);
      return [];
    }
  }

  async getRouteStats() {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { direct: 0, llm: 0, fallback: 0 };
    }

    try {
      const { data } = await client
        .from('query_logs')
        .select('route');

      if (!data) {
        return { direct: 0, llm: 0, fallback: 0 };
      }

      let direct = 0;
      let llm = 0;
      let fallback = 0;

      for (const row of data) {
        const route = row.route;
        if (route === RouteType.DIRECT || route === RouteType.DIRECT_FALLBACK) {
          direct++;
        } else if (route === RouteType.LLM_SYNTHESIS || route === RouteType.LLM_SYNTHESIS) {
          llm++;
        } else if (route === RouteType.FALLBACK) {
          fallback++;
        }
      }

      return { direct, llm, fallback };
    } catch (error) {
      this.logger.error('Error getting route stats:', error);
      return { direct: 0, llm: 0, fallback: 0 };
    }
  }

  async getLlmMetrics() {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { count: 0 };
    }

    try {
      const { data, error } = await client
        .from('query_logs')
        .select('route, response_time_ms, feedback')
        .in('route', [RouteType.LLM_SYNTHESIS, RouteType.LLM_SYNTHESIS]);

      if (error) {
        this.logger.error('Error getting LLM metrics:', error);
        return { count: 0 };
      }

      const count = data?.length || 0;
      
      // Check if latency and failure columns exist
      const hasLatency = data && data.length > 0 && 'response_time_ms' in data[0];
      const hasFeedback = data && data.length > 0 && 'feedback' in data[0];

      const result: { count: number; avgLatency?: number; failureCount?: number } = { count };

      if (hasLatency && data) {
        const totalLatency = data.reduce((sum, row) => sum + (row.response_time_ms || 0), 0);
        result.avgLatency = Math.round(totalLatency / data.length);
      }

      if (hasFeedback && data) {
        result.failureCount = data.filter(row => row.feedback === false).length;
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting LLM metrics:', error);
      return { count: 0 };
    }
  }

  async getFeedbackStats() {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { thumbsUp: 0, thumbsDown: 0, noFeedback: 0 };
    }

    try {
      const { data } = await client
        .from('query_logs')
        .select('feedback');

      if (!data) {
        return { thumbsUp: 0, thumbsDown: 0, noFeedback: 0 };
      }

      let thumbsUp = 0;
      let thumbsDown = 0;
      let noFeedback = 0;

      for (const row of data) {
        if (row.feedback === 1) {
          thumbsUp++;
        } else if (row.feedback === -1) {
          thumbsDown++;
        } else {
          noFeedback++;
        }
      }

      return { thumbsUp, thumbsDown, noFeedback };
    } catch (error) {
      this.logger.error('Error getting feedback stats:', error);
      return { thumbsUp: 0, thumbsDown: 0, noFeedback: 0 };
    }
  }
}


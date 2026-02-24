import {
  Controller,
  Get,
  Query,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiKeyGuard } from '../admin/api-key.guard';

// Define proper interfaces for query log data
interface QueryLog {
  similarity_score: number | null;
  response_time_ms: number | null;
  route_decision: string | null;
  llm_used: boolean | null;
  query_text: string | null;
  feedback: boolean | null;
  rating: number | null;
  feedback_type: string | null;
}

interface RouteStats {
  count: number;
  totalSim: number;
  totalTime: number;
}

@Controller('metrics')
export class MetricsController {
  constructor(private supabaseService: SupabaseService) { }

  @Get()
  async getMetrics() {
    try {
      const supabase = this.supabaseService.getClient();

      const { count } = await supabase
        .from('query_logs')
        .select('*', { count: 'exact', head: true });

      const { data: avgSimData } = await supabase.rpc('get_avg_similarity');
      const avgSim = avgSimData ? (avgSimData * 100) : 0;

      const { data: routeStatsData } = await supabase.rpc('get_route_stats');
      const routes: Record<string, number> = {};
      if (routeStatsData) {
        routeStatsData.forEach((stat: any) => {
          routes[stat.route || 'unknown'] = Number(stat.count);
        });
      }

      const { data: llmAndResponseLogs } = await supabase
        .from('query_logs')
        .select('response_time_ms, llm_used')
        .order('created_at', { ascending: false })
        .limit(1000);

      let avgTime = 0;
      let llmUsed = 0;
      let totalFetched = llmAndResponseLogs?.length || 0;

      if (llmAndResponseLogs && totalFetched > 0) {
        avgTime =
          llmAndResponseLogs.reduce(
            (sum, log: QueryLog) => sum + (log.response_time_ms || 0),
            0,
          ) / totalFetched;
        llmUsed = llmAndResponseLogs.filter((log: QueryLog) => log.llm_used).length;
      }

      return {
        totalQueries: count ?? 0,
        averageSimilarity: Number(avgSim.toFixed(2)),
        averageResponseTime: Math.round(avgTime),
        routeBreakdown: routes,
        llmUsageRate: totalFetched > 0 ? Math.round((llmUsed / totalFetched) * 100) : 0,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch metrics');
    }
  }

  @Get('top-queries')
  async topQueries(@Query('limit') limit: string = '20') {
    try {
      const supabase = this.supabaseService.getClient();

      const limit_count = parseInt(limit);
      const { data: logs, error } = await supabase.rpc('get_top_queries', { limit_count });

      if (error) throw error;
      if (!logs) return [];

      return logs.map((log: any) => ({
        query: log.query || 'unknown',
        count: Number(log.count),
        // Setting an empty avgConfidence since it's no longer computed in RPC, to keep shape compatible
        avgConfidence: 0,
      }));
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch top queries');
    }
  }

  @Get('route-stats')
  async getRouteStats() {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: logs, error } = await supabase.rpc('get_route_stats');

      if (error) throw error;
      if (!logs) return {};

      const total = logs.reduce((acc: number, log: any) => acc + Number(log.count), 0);
      const result: Record<
        string,
        {
          count: number;
          percentage: number;
          avgConfidence: number;
          avgResponseTime: number;
        }
      > = {};

      logs.forEach((log: any) => {
        const route = log.route || 'unknown';
        result[route] = {
          count: Number(log.count),
          percentage: total > 0 ? Number(((Number(log.count) / total) * 100).toFixed(1)) : 0,
          avgConfidence: 0, // Not available in RPC
          avgResponseTime: 0, // Not available in RPC
        };
      });

      return result;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch route stats');
    }
  }

  @Get('llm-metrics')
  async getLlmMetrics() {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: logs } = await supabase
        .from('query_logs')
        .select('route_decision, llm_used')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!logs) return { totalSynthesisAttempts: 0, successRate: 0, usage: 0 };

      const synthesisAttempts = logs.filter(
        (log: QueryLog) =>
          log.route_decision === 'llm_synthesis' || log.llm_used,
      ).length;
      const successfulSynthesis = logs.filter(
        (log: QueryLog) => log.route_decision === 'llm_synthesis',
      ).length;
      const llmUsed = logs.filter((log: QueryLog) => log.llm_used).length;

      return {
        totalAttempts: synthesisAttempts,
        successful: successfulSynthesis,
        successRate:
          synthesisAttempts > 0
            ? Number(
              ((successfulSynthesis / synthesisAttempts) * 100).toFixed(1),
            )
            : 0,
        totalUsed: llmUsed,
        usageRate: Number(((llmUsed / logs.length) * 100).toFixed(1)),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch LLM metrics');
    }
  }

  @Get('feedback-stats')
  async getFeedbackStats() {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: logs } = await supabase
        .from('query_logs')
        .select('feedback, rating, feedback_type')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!logs) {
        return {
          totalFeedback: 0,
          helpfulRate: 0,
          avgRating: 0,
          feedbackTypes: {},
        };
      }

      const withFeedback = logs.filter(
        (log: QueryLog) => log.feedback !== null && log.feedback !== undefined,
      );
      const helpful = withFeedback.filter(
        (log: QueryLog) => log.feedback === true,
      ).length;
      const ratings = logs
        .filter((log: QueryLog) => (log.rating || 0) > 0)
        .map((log: QueryLog) => log.rating || 0);
      const avgRating =
        ratings.length > 0
          ? (
            ratings.reduce((a: number, b: number) => a + b) / ratings.length
          ).toFixed(1)
          : 0;

      const feedbackTypes: Record<string, number> = {};
      logs.forEach((log: QueryLog) => {
        if (log.feedback_type) {
          feedbackTypes[log.feedback_type] =
            (feedbackTypes[log.feedback_type] || 0) + 1;
        }
      });

      return {
        totalFeedback: withFeedback.length,
        helpfulRate:
          withFeedback.length > 0
            ? Number(((helpful / withFeedback.length) * 100).toFixed(1))
            : 0,
        avgRating: Number(avgRating),
        feedbackTypes,
        ratingDistribution: {
          fiveStar: logs.filter((log: QueryLog) => log.rating === 5).length,
          fourStar: logs.filter((log: QueryLog) => log.rating === 4).length,
          threeStar: logs.filter((log: QueryLog) => log.rating === 3).length,
          twoStar: logs.filter((log: QueryLog) => log.rating === 2).length,
          oneStar: logs.filter((log: QueryLog) => log.rating === 1).length,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch feedback stats');
    }
  }
}

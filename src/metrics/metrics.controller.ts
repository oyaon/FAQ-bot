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
@UseGuards(ApiKeyGuard)
export class MetricsController {
  constructor(private supabaseService: SupabaseService) {}

  @Get()
  async getMetrics() {
    try {
      const supabase = this.supabaseService.getClient();

      const { count } = await supabase
        .from('query_logs')
        .select('*', { count: 'exact', head: true });

      const { data: allLogs } = await supabase
        .from('query_logs')
        .select('similarity_score, response_time_ms, route_decision, llm_used')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!allLogs || allLogs.length === 0) {
        return {
          totalQueries: 0,
          averageSimilarity: 0,
          averageResponseTime: 0,
          routeBreakdown: {},
          llmUsageRate: 0,
        };
      }

      const avgSim =
        (allLogs.reduce(
          (sum, log: QueryLog) => sum + (log.similarity_score || 0),
          0,
        ) /
          allLogs.length) *
        100;
      const avgTime =
        allLogs.reduce(
          (sum, log: QueryLog) => sum + (log.response_time_ms || 0),
          0,
        ) / allLogs.length;

      const routes = allLogs.reduce(
        (acc: Record<string, number>, log: QueryLog) => {
          const route = log.route_decision || 'unknown';
          acc[route] = (acc[route] || 0) + 1;
          return acc;
        },
        {},
      );

      const llmUsed = allLogs.filter((log: QueryLog) => log.llm_used).length;

      return {
        totalQueries: count ?? 0,
        averageSimilarity: Number(avgSim.toFixed(2)),
        averageResponseTime: Math.round(avgTime),
        routeBreakdown: routes,
        llmUsageRate: Math.round((llmUsed / allLogs.length) * 100),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch metrics');
    }
  }

  @Get('top-queries')
  async topQueries(@Query('limit') limit: string = '20') {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: logs } = await supabase
        .from('query_logs')
        .select('query_text, similarity_score')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!logs) return [];

      const queryMap = new Map<
        string,
        { count: number; totalSimilarity: number }
      >();

      logs.forEach((log: QueryLog) => {
        const query = log.query_text?.toLowerCase() || 'unknown';
        const current = queryMap.get(query) || { count: 0, totalSimilarity: 0 };
        current.count++;
        current.totalSimilarity += log.similarity_score || 0;
        queryMap.set(query, current);
      });

      return Array.from(queryMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, parseInt(limit))
        .map(([query, stats]) => ({
          query,
          count: stats.count,
          avgConfidence: Number(
            ((stats.totalSimilarity / stats.count) * 100).toFixed(1),
          ),
        }));
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch top queries');
    }
  }

  @Get('route-stats')
  async getRouteStats() {
    try {
      const supabase = this.supabaseService.getClient();

      const { data: logs } = await supabase
        .from('query_logs')
        .select('route_decision, similarity_score, response_time_ms')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!logs) return {};

      const routes = new Map<string, RouteStats>();

      logs.forEach((log: QueryLog) => {
        const route = log.route_decision || 'unknown';
        const current = routes.get(route) || {
          count: 0,
          totalSim: 0,
          totalTime: 0,
        };
        current.count++;
        current.totalSim += log.similarity_score || 0;
        current.totalTime += log.response_time_ms || 0;
        routes.set(route, current);
      });

      const total = logs.length;
      const result: Record<
        string,
        {
          count: number;
          percentage: number;
          avgConfidence: number;
          avgResponseTime: number;
        }
      > = {};

      routes.forEach((stats, route) => {
        result[route] = {
          count: stats.count,
          percentage: Number(((stats.count / total) * 100).toFixed(1)),
          avgConfidence: Number(
            ((stats.totalSim / stats.count) * 100).toFixed(1),
          ),
          avgResponseTime: Math.round(stats.totalTime / stats.count),
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

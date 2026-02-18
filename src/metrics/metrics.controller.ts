import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Controller('metrics')
export class MetricsController {
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  @Get()
  async getMetrics() {
    const { count } = await this.supabase
      .from('query_logs')
      .select('*', { count: 'exact', head: true });

    const { data: avgSimilarity } = await this.supabase
      .from('query_logs')
      .select('similarity_score');

    const avg =
      avgSimilarity && avgSimilarity.length
        ? avgSimilarity.reduce((a, b) => a + (b.similarity_score || 0), 0) /
          avgSimilarity.length
        : 0;

    return {
      totalQueries: count ?? 0,
      averageSimilarity: Number(avg.toFixed(3)),
    };
  }

  @Get('top-queries')
  async topQueries() {
    const { data } = await this.supabase.rpc('top_queries');
    return data || [];
  }
}


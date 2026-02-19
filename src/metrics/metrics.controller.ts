import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('metrics')
export class MetricsController {
  constructor(private supabaseService: SupabaseService) {}

  @Get()
  async getMetrics() {
    const supabase = this.supabaseService.getClient();

    const { count } = await supabase
      .from('query_logs')
      .select('*', { count: 'exact', head: true });

    const { data: avgSimilarity } = await supabase
      .from('query_logs')
      .select('similarity_score');

    const avg =
      avgSimilarity && avgSimilarity.length > 0
        ? avgSimilarity.reduce(
            (a, b) => a + (b.similarity_score || 0),
            0,
          ) / avgSimilarity.length * 100
        : 0;

    return {
      totalQueries: count ?? 0,
      averageSimilarity: Number(avg.toFixed(3)),
    };
  }

  @Get('top-queries')
  async topQueries() {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase.rpc('top_queries');
    return data || [];
  }
}

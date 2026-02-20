import { Controller, Get, Query, Res, BadRequestException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { parse } from 'json2csv';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiKeyGuard } from './api-key.guard';

@Controller('admin')
@UseGuards(ApiKeyGuard)
export class AdminController {
  constructor(private supabaseService: SupabaseService) {}

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  @Get()
  async dashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Validate date parameters
    if (startDate && !this.isValidDate(startDate)) {
      throw new BadRequestException('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)');
    }
    if (endDate && !this.isValidDate(endDate)) {
      throw new BadRequestException('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)');
    }

    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('query_logs')
      .select('*', { count: 'exact', head: true });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { count } = await query;

    let similarityQuery = supabase
      .from('query_logs')
      .select('similarity_score');

    if (startDate) {
      similarityQuery = similarityQuery.gte('created_at', startDate);
    }
    if (endDate) {
      similarityQuery = similarityQuery.lte('created_at', endDate);
    }

    const { data: similarities } = await similarityQuery;

    const avg =
      similarities && similarities.length > 0
        ? similarities.reduce(
            (a, b) => a + ((b.similarity_score ?? 0) || 0),
            0,
          ) / similarities.length
        : 0;

    let lowQuery = supabase
      .from('query_logs')
      .select('query_text, similarity_score')
      .lt('similarity_score', 0.5)
      .order('created_at', { ascending: false })
      .limit(10);

    if (startDate) {
      lowQuery = lowQuery.gte('created_at', startDate);
    }
    if (endDate) {
      lowQuery = lowQuery.lte('created_at', endDate);
    }

    const { data: low } = await lowQuery;

    return {
      totalQueries: count ?? 0,
      averageSimilarity: Number((avg * 100).toFixed(1)),
      lowConfidenceRecent: low ?? [],
    };
  }

  @Get('export')
  async exportLogs(
    @Res() res: Response,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('query_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    if (format === 'csv') {
      const csv = parse(data || []);
      res.header('Content-Type', 'text/csv');
      res.attachment('query_logs.csv');
      return res.send(csv);
    } else {
      res.header('Content-Type', 'application/json');
      res.attachment('query_logs.json');
      return res.send(data);
    }
  }
}

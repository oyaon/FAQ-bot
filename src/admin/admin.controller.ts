import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  UseGuards,
  Redirect,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { parse } from 'json2csv';
import { SupabaseService } from '../supabase/supabase.service';
import { ApiKeyGuard } from './api-key.guard';

interface QueryLogData {
  id: number;
  query_text: string;
  similarity_score: number;
  created_at: string;
  route_decision: string;
}

interface CategoryData {
  matched_faq_category: string;
}

@Controller('admin')
@UseGuards(ThrottlerGuard, ApiKeyGuard)
export class AdminController {
  constructor(private supabaseService: SupabaseService) {}

  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  @Get('analytics')
  @Redirect('/admin/index.html', 302)
  analytics(): void {
    // Serves index.html from /public/admin folder via ServeStaticModule
  }

  @Get()
  @Redirect('/admin/index.html', 302)
  dashboardRedirect(): void {
    // Redirect root /admin to analytics dashboard
  }

  @Get('dashboard')
  async dashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Validate date parameters
    if (startDate && !this.isValidDate(startDate)) {
      throw new BadRequestException(
        'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
    }
    if (endDate && !this.isValidDate(endDate)) {
      throw new BadRequestException(
        'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
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

  @Get('low-confidence')
  async lowConfidenceQueries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Parse and validate pagination parameters
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    if (parsedPage < 1 || !Number.isInteger(parsedPage)) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (
      parsedLimit < 1 ||
      parsedLimit > 100 ||
      !Number.isInteger(parsedLimit)
    ) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    // Validate date parameters
    if (startDate && !this.isValidDate(startDate)) {
      throw new BadRequestException(
        'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
    }
    if (endDate && !this.isValidDate(endDate)) {
      throw new BadRequestException(
        'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
    }

    const supabase = this.supabaseService.getClient();
    const offset = (parsedPage - 1) * parsedLimit;

    // Get total count
    let countQuery = supabase
      .from('query_logs')
      .select('*', { count: 'exact', head: true })
      .lt('similarity_score', 0.5);

    if (startDate) {
      countQuery = countQuery.gte('created_at', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('created_at', endDate);
    }

    const { count } = await countQuery;
    const total = count ?? 0;
    const totalPages = Math.ceil(total / parsedLimit);

    // Get paginated data
    let dataQuery = supabase
      .from('query_logs')
      .select('id, query_text, similarity_score, created_at, route_decision')
      .lt('similarity_score', 0.5)
      .order('created_at', { ascending: false })
      .range(offset, offset + parsedLimit - 1);

    if (startDate) {
      dataQuery = dataQuery.gte('created_at', startDate);
    }
    if (endDate) {
      dataQuery = dataQuery.lte('created_at', endDate);
    }

    const {
      data,
      error,
    }: { data: QueryLogData[] | null; error: { message: string } | null } =
      await dataQuery;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch low-confidence queries: ${String(error.message)}`,
      );
    }

    return {
      data: data ?? [],
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1,
      },
    };
  }

  @Get('categories')
  async getCategoryBreakdown(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Validate date parameters
    if (startDate && !this.isValidDate(startDate)) {
      throw new BadRequestException(
        'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
    }
    if (endDate && !this.isValidDate(endDate)) {
      throw new BadRequestException(
        'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)',
      );
    }

    const supabase = this.supabaseService.getClient();

    // Query all query logs and aggregate by category
    let query = supabase.from('query_logs').select('matched_faq_category');

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const {
      data,
      error,
    }: {
      data: CategoryData[] | null;
      error: { message: string } | null;
    } = await query;

    if (error) {
      throw new BadRequestException(
        `Failed to fetch category data: ${String(error.message)}`,
      );
    }

    // Aggregate counts by category
    const categoryMap = new Map<string, number>();

    if (data) {
      for (const row of data) {
        if (row.matched_faq_category) {
          const category = row.matched_faq_category;
          categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
        }
      }
    }

    // Convert to array and sort by count (descending)
    const categories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      categories,
      total: categories.reduce((sum, cat) => sum + cat.count, 0),
    };
  }

  @Get('export')
  async exportLogs(
    @Res() res: Response,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Query('limit') limit = 10000,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const safeLimit = Math.min(Number(limit), 10000);

    let query = supabase
      .from('query_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const {
      data,
      error,
    }: {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    } = await query;
    if (error) throw new Error(String(error.message));

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

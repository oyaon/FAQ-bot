import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';
import { ApiKeyGuard } from '../admin/api-key.guard';

@Controller('metrics')
@UseGuards(ThrottlerGuard, ApiKeyGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getSummary() {
    return this.metricsService.getSummary();
  }

  @Get('top-queries')
  async getTopQueries(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.metricsService.getTopQueries(limit);
  }

  @Get('route-stats')
  async getRouteStats() {
    return this.metricsService.getRouteStats();
  }

  @Get('llm-metrics')
  async getLlmMetrics() {
    return this.metricsService.getLlmMetrics();
  }

  @Get('feedback-stats')
  async getFeedbackStats() {
    return this.metricsService.getFeedbackStats();
  }
}

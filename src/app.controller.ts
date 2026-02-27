import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { EmbeddingService } from './embedding/embedding.service';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly embeddingService: EmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(): {
    status: string;
    timestamp: string;
    services?: { embedding?: string; supabase?: string };
  } {
    // Debug logging
    console.log('[DEBUG] AppController health() called');
    console.log('[DEBUG] SupabaseService instance:', this.supabaseService);
    console.log(
      '[DEBUG] SupabaseService isConnected:',
      this.supabaseService?.isConnected?.(),
    );

    const embeddingReady = this.embeddingService?.isReady?.() ?? false;
    const supabaseReady = this.supabaseService?.isConnected() ?? false;

    console.log(
      '[DEBUG] embeddingReady:',
      embeddingReady,
      'supabaseReady:',
      supabaseReady,
    );

    const services: { embedding?: string; supabase?: string } = {};

    if (!embeddingReady) {
      services.embedding = 'initializing';
    }
    if (!supabaseReady) {
      services.supabase = 'disconnected';
    }

    // If any service is not ready, status should indicate that
    const status = embeddingReady && supabaseReady ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: Object.keys(services).length > 0 ? services : undefined,
    };
  }

  @Post('csp-report')
  handleCspReport(@Body() report: any): { success: boolean } {
    // Log CSP violations for monitoring
    Logger.warn('CSP Violation Report:', JSON.stringify(report, null, 2));
    return { success: true };
  }
}

import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('csp-report')
  handleCspReport(@Body() report: any): { success: boolean } {
    // Log CSP violations for monitoring
    Logger.warn('CSP Violation Report:', JSON.stringify(report, null, 2));
    return { success: true };
  }
}

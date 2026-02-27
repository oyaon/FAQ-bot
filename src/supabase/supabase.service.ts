import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);
  private isAvailable = false;

  onModuleInit(): void {
    const url = process.env.SUPABASE_URL;
    // Support both names to avoid breaking existing deployments.
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_KEY not set. Supabase is disabled. Data will not persist.',
      );
      this.client = null;
      this.isAvailable = false;
      return;
    }

    try {
      this.client = createClient(url, key);
      this.isAvailable = true;
      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error);
      this.client = null;
      this.isAvailable = false;
    }
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  isConnected(): boolean {
    return this.isAvailable && this.client !== null;
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(SupabaseService.name);
  public supabase: SupabaseClient | null = null;
  public isInitialized = false;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    // Initialize synchronously in constructor
    if (!url || !key) {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_ANON_KEY not configured. Supabase features will be disabled.',
      );
      this.isInitialized = false;
      return;
    }

    this.logger.debug('Initializing Supabase client');
    this.supabase = createClient(url, key) as SupabaseClient;
    this.isInitialized = true;
    this.logger.log('Supabase client initialized successfully');
  }

  /**
   * Returns whether the Supabase client is initialized and ready
   */
  isReady(): boolean {
    const ready = this.isInitialized && this.supabase !== null;
    this.logger.debug(`isReady() called, returning: ${ready}`);
    return ready;
  }

  getClient(): SupabaseClient | null {
    return this.supabase;
  }

  /**
   * Check if Supabase is ready by performing a lightweight query
   */
  public async healthCheck(): Promise<boolean> {
    if (!this.isInitialized || !this.supabase) {
      return false;
    }

    try {
      // Perform a lightweight query to verify connection
      const { error } = await this.supabase
        .from('faq')
        .select('id')
        .limit(1);

      if (error) {
        this.logger.warn(`Supabase health check failed: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Supabase health check error: ${errorMessage}`);
      return false;
    }
  }

  async onModuleDestroy() {
    // Close any open connections
  }

  async query(
    table: string,
    queryFn: (client: SupabaseClient) => Promise<unknown>,
  ): Promise<unknown> {
    if (!this.supabase) {
      this.logger.warn(
        `Supabase not initialized, skipping query on table ${table}`,
      );
      return null;
    }

    try {
      return await queryFn(this.supabase);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Supabase query error on table ${table}: ${errorMessage}`,
      );
      throw new Error('Database operation failed');
    }
  }
}


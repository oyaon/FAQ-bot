import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    // Validate environment variables
    const missingVars: string[] = [];
    if (!url) {
      missingVars.push('SUPABASE_URL');
    }
    if (!key) {
      missingVars.push('SUPABASE_ANON_KEY');
    }
    
    if (missingVars.length > 0) {
      this.logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    this.logger.debug('Initializing Supabase client');
    this.supabase = createClient(url, key) as SupabaseClient;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async onModuleDestroy() {
    // Close any open connections
    // Supabase client doesn't need explicit cleanup
    // but this hook allows Jest to exit cleanly
  }

  async query(
    table: string,
    queryFn: (client: SupabaseClient) => Promise<unknown>,
  ): Promise<unknown> {
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

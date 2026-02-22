import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      this.logger.error('Missing Supabase credentials');
      throw new Error('Supabase credentials not configured');
    }
    this.supabase = createClient(url, key) as SupabaseClient;
  }

  getClient(): SupabaseClient {
    return this.supabase;
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

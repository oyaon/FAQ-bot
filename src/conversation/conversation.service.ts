import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Session {
  id: string;
  messages: Message[];
  createdAt: Date;
  lastActiveAt: Date;
}

interface SessionRow {
  id: string;
  messages: Message[];
  created_at: string;
  last_active_at: string;
}

@Injectable()
export class ConversationService implements OnModuleInit {
  private readonly logger = new Logger(ConversationService.name);
  private sessions = new Map<string, Session>();
  private isInitialized = false;
  private supabaseAvailable = false;
  private supabaseService: SupabaseService;

  constructor(
    @Inject(forwardRef(() => SupabaseService)) 
    private readonly injectedSupabaseService: SupabaseService,
  ) {
    // Store reference - will be used after all modules initialize
    this.supabaseService = injectedSupabaseService;
    this.logger.log('ConversationService constructed');
  }

  async onModuleInit() {
    // SupabaseService should now be available after all modules initialized
    this.supabaseAvailable = this.supabaseService?.isReady() ?? false;
    
    this.logger.log(
      'ConversationService initialized (in-memory + Supabase persistence)',
    );
    
    if (!this.supabaseAvailable) {
      this.logger.warn(
        'Supabase not available - using in-memory sessions only. ' +
        'Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.loadSessionsFromSupabase();
    }
    
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
    // Periodic sync to Supabase - only if available
    if (this.supabaseAvailable) {
      setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncSessionsToSupabase();
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Get Supabase client with null safety
   */
  private getSupabaseClient(): SupabaseClient | null {
    if (!this.supabaseService) {
      this.logger.warn('SupabaseService is not available');
      return null;
    }
    return this.supabaseService.getClient();
  }

  /**
   * Load sessions from Supabase on startup
   */
  private async loadSessionsFromSupabase(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      if (!supabase) {
        this.logger.warn(
          'Supabase not available, using in-memory sessions only',
        );
        return;
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('last_active_at', { ascending: false })
        .limit(100);

      if (error) {
        this.logger.warn(
          `Failed to load sessions from Supabase: ${error.message}`,
        );
        return;
      }

      if (data && data.length > 0) {
        for (const row of data as SessionRow[]) {
          const session: Session = {
            id: row.id,
            messages: row.messages || [],
            createdAt: new Date(row.created_at),
            lastActiveAt: new Date(row.last_active_at),
          };
          this.sessions.set(session.id, session);
        }
        this.logger.log(`Loaded ${data.length} sessions from Supabase`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error loading sessions from Supabase: ${errorMessage}`);
    }
  }

  /**
   * Sync all sessions to Supabase (called periodically)
   */
  private async syncSessionsToSupabase(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      if (!supabase) return;

      for (const [, session] of this.sessions) {
        const { error } = await supabase
          .from('sessions')
          .upsert(
            {
              id: session.id,
              messages: session.messages,
              created_at: session.createdAt.toISOString(),
              last_active_at: session.lastActiveAt.toISOString(),
            },
            { onConflict: 'id' },
          );

        if (error) {
          this.logger.warn(
            `Failed to sync session ${session.id}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error syncing sessions to Supabase: ${errorMessage}`);
    }
  }

  createSession(): string {
    const id = uuidv4();
    const session: Session = {
      id,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.sessions.set(id, session);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.saveSessionToSupabase(session);
    return id;
  }

  /**
   * Save a single session to Supabase immediately
   */
  private async saveSessionToSupabase(session: Session): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      if (!supabase) return;

      const { error } = await supabase
        .from('sessions')
        .upsert(
          {
            id: session.id,
            messages: session.messages,
            created_at: session.createdAt.toISOString(),
            last_active_at: session.lastActiveAt.toISOString(),
          },
          { onConflict: 'id' },
        );

      if (error) {
        this.logger.warn(
          `Failed to save session ${session.id}: ${error.message}`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error saving session to Supabase: ${errorMessage}`);
    }
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.lastActiveAt = new Date();
    return session;
  }

  addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): void {
    let session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.warn(`Session ${sessionId} not found, creating new one`);
      session = {
        id: sessionId,
        messages: [],
        createdAt: new Date(),
        lastActiveAt: new Date(),
      };
      this.sessions.set(sessionId, session);
    }

    session.messages.push({
      role,
      content,
      timestamp: new Date(),
    });

    session.lastActiveAt = new Date();

    // Keep only last 10 messages to prevent memory bloat
    if (session.messages.length > 10) {
      session.messages = session.messages.slice(-10);
    }

    // Persist to Supabase
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.saveSessionToSupabase(session);
  }

  getRecentContext(sessionId: string, count = 4): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.messages.slice(-count);
  }

  private cleanup(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt < oneHourAgo) {
        this.sessions.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
    }
  }
}


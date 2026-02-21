import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../supabase/supabase.service';

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

@Injectable()
export class ConversationService implements OnModuleInit {
  private readonly logger = new Logger(ConversationService.name);
  // In-memory cache for fast access
  private sessions = new Map<string, Session>();

  // Clean up old sessions every 30 minutes
  constructor(private supabaseService: SupabaseService) {
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  async onModuleInit() {
    // Load recent sessions from Supabase on startup
    await this.loadRecentSessions();
  }

  private async loadRecentSessions() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('sessions')
        .select('*')
        .gte('last_active_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (error) {
        this.logger.warn('Could not load sessions from Supabase, using in-memory only');
        return;
      }

      if (data) {
        for (const row of data) {
          this.sessions.set(row.id, {
            id: row.id,
            messages: row.messages || [],
            createdAt: new Date(row.created_at),
            lastActiveAt: new Date(row.last_active_at),
          });
        }
        this.logger.log(`Loaded ${data.length} sessions from Supabase`);
      }
    } catch (error) {
      this.logger.warn('Failed to load sessions from Supabase:', error);
    }
  }

  async createSession(): Promise<string> {
    const id = uuidv4();
    const session: Session = {
      id,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.sessions.set(id, session);

    // Persist to Supabase
    try {
      await this.supabaseService.getClient().from('sessions').insert({
        id,
        messages: [],
        created_at: session.createdAt.toISOString(),
        last_active_at: session.lastActiveAt.toISOString(),
      });
    } catch (error) {
      this.logger.warn('Failed to persist session to Supabase:', error);
    }

    return id;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    // Try in-memory first
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try loading from Supabase
      try {
        const { data, error } = await this.supabaseService.getClient()
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!error && data) {
          session = {
            id: data.id,
            messages: data.messages || [],
            createdAt: new Date(data.created_at),
            lastActiveAt: new Date(data.last_active_at),
          };
          this.sessions.set(sessionId, session);
        }
      } catch (error) {
        this.logger.warn('Failed to load session from Supabase:', error);
      }
    }

    if (!session) return null;

    session.lastActiveAt = new Date();
    
    // Update last_active_at in Supabase
    try {
      await this.supabaseService.getClient()
        .from('sessions')
        .update({ last_active_at: session.lastActiveAt.toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      // Silently fail - in-memory is still valid
    }

    return session;
  }

  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try to load from Supabase
      await this.getSession(sessionId);
      session = this.sessions.get(sessionId);
    }

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
    try {
      await this.supabaseService.getClient()
        .from('sessions')
        .upsert({
          id: sessionId,
          messages: session.messages,
          last_active_at: session.lastActiveAt.toISOString(),
        }, { onConflict: 'id' });
    } catch (error) {
      this.logger.warn('Failed to persist message to Supabase:', error);
    }
  }

  getRecentContext(sessionId: string, count = 4): Message[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.messages.slice(-count);
  }

  private async cleanup(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const toDelete: string[] = [];

    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt < oneHourAgo) {
        toDelete.push(id);
        this.sessions.delete(id);
      }
    }

    // Delete from Supabase
    if (toDelete.length > 0) {
      try {
        await this.supabaseService.getClient()
          .from('sessions')
          .delete()
          .in('id', toDelete);
        this.logger.log(`Cleaned up ${toDelete.length} expired sessions`);
      } catch (error) {
        this.logger.warn('Failed to delete sessions from Supabase:', error);
      }
    }
  }
}

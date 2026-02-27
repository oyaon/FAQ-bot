import { Injectable, Logger, Optional } from '@nestjs/common';
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
  updatedAt: Date;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly inMemorySessions = new Map<string, Session>();
  private useInMemory = false;

  constructor(@Optional() private readonly supabaseService?: SupabaseService) {
    if (!this.supabaseService || !this.supabaseService.isConnected()) {
      this.logger.warn(
        'Supabase not available. Using in-memory session storage. Sessions will NOT persist across restarts.',
      );
      this.useInMemory = true;
    }
  }

  async createSession(): Promise<string> {
    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.useInMemory || !this.supabaseService?.isConnected()) {
      this.inMemorySessions.set(sessionId, session);
      this.logger.debug(`Created in-memory session: ${sessionId}`);
      return sessionId;
    }

    try {
      const client = this.supabaseService.getClient();
      if (!client) {
        this.inMemorySessions.set(sessionId, session);
        return sessionId;
      }

      const { error } = await client.from('sessions').insert({
        id: sessionId,
        messages: [],
        created_at: session.createdAt.toISOString(),
        updated_at: session.updatedAt.toISOString(),
      });

      if (error) {
        this.logger.warn(
          `Supabase insert failed, using in-memory: ${error.message}`,
        );
        this.inMemorySessions.set(sessionId, session);
      } else {
        this.logger.debug(`Created Supabase session: ${sessionId}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to create session in Supabase, using in-memory: ${error}`,
      );
      this.inMemorySessions.set(sessionId, session);
    }

    return sessionId;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    // Check in-memory first
    if (this.inMemorySessions.has(sessionId)) {
      return this.inMemorySessions.get(sessionId) || null;
    }

    if (this.useInMemory || !this.supabaseService?.isConnected()) {
      return null;
    }

    try {
      const client = this.supabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        this.logger.warn(`Session not found: ${sessionId}`);
        return null;
      }

      return {
        id: data.id,
        messages: data.messages || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      this.logger.warn(`Failed to get session from Supabase: ${error}`);
      return null;
    }
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    const message: Message = {
      role,
      content,
      timestamp: new Date(),
    };

    // Update in-memory if it exists there
    const inMemorySession = this.inMemorySessions.get(sessionId);
    if (inMemorySession) {
      inMemorySession.messages.push(message);
      inMemorySession.updatedAt = new Date();
      this.logger.debug(`Saved message to in-memory session: ${sessionId}`);
      return;
    }

    if (this.useInMemory || !this.supabaseService?.isConnected()) {
      // Create a new in-memory session for this message
      this.inMemorySessions.set(sessionId, {
        id: sessionId,
        messages: [message],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return;
    }

    try {
      const client = this.supabaseService.getClient();
      if (!client) return;

      // Get existing messages
      const { data } = await client
        .from('sessions')
        .select('messages')
        .eq('id', sessionId)
        .single();

      const existingMessages = data?.messages || [];
      existingMessages.push(message);

      const { error } = await client
        .from('sessions')
        .update({
          messages: existingMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        this.logger.warn(
          `Failed to save message to Supabase: ${error.message}`,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to save message: ${error}`);
    }
  }

  async getConversationHistory(sessionId: string): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    return session?.messages || [];
  }
}

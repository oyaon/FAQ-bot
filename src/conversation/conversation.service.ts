import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

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
  private sessions = new Map<string, Session>();
  private isInitialized = false;

  async onModuleInit() {
    this.logger.log('ConversationService initialized (in-memory sessions only)');
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  async createSession(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('ConversationService not initialized');
    }

    const id = uuidv4();
    const session: Session = {
      id,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.sessions.set(id, session);
    return id;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.lastActiveAt = new Date();
    return session;
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
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


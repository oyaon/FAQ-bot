import { Injectable } from '@nestjs/common';
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
export class ConversationService {
  private sessions = new Map<string, Session>();

  // Clean up old sessions every 30 minutes
  constructor() {
    setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  createSession(): string {
    const id = uuidv4();
    this.sessions.set(id, {
      id,
      messages: [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });
    return id;
  }

  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.lastActiveAt = new Date();
    return session;
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

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
    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt < oneHourAgo) {
        this.sessions.delete(id);
      }
    }
  }
}

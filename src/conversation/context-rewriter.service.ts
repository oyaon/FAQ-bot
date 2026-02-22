import { Injectable } from '@nestjs/common';
import { Message } from './conversation.service';

@Injectable()
export class ContextRewriterService {
  rewriteWithContext(currentQuery: string, history: Message[]): string {
    if (history.length === 0) return currentQuery;

    // Check if the query is self-contained or needs context
    if (this.isSelfContained(currentQuery)) {
      return currentQuery;
    }

    // Build context from recent conversation
    const rewritten = this.buildContextualQuery(currentQuery, history);
    return rewritten;
  }

  private isSelfContained(query: string): boolean {
    const lowered = query.toLowerCase().trim();

    // Short vague queries likely need context
    if (lowered.split(' ').length <= 3) {
      // But some short queries ARE self-contained
      const selfContainedShort = [
        'help',
        'hello',
        'hi',
        'thanks',
        'bye',
        'what do you do',
        'who are you',
      ];
      if (selfContainedShort.some((s) => lowered.includes(s))) {
        return true;
      }
      return false;
    }

    // Pronouns and references suggest context needed
    const contextClues = [
      'it',
      'that',
      'this',
      'they',
      'them',
      'those',
      'these',
      'the same',
      'what about',
      'how about',
      'and if',
      'what if',
      'but what',
      'also',
      'too',
      'instead',
      'another',
    ];

    const needsContext = contextClues.some((clue) => {
      const regex = new RegExp(`\\b${clue}\\b`, 'i');
      return regex.test(lowered);
    });

    return !needsContext;
  }

  private buildContextualQuery(
    currentQuery: string,
    history: Message[],
  ): string {
    // Get the last bot response and user question for context
    const lastExchange = this.getLastExchange(history);

    if (!lastExchange) return currentQuery;

    // Extract the topic from the last exchange
    const topic = this.extractTopic(lastExchange);

    if (!topic) return currentQuery;

    // Rewrite the query with context
    // Example: "what about damaged items?" + topic "returns"
    // → "what about damaged items regarding returns policy?"
    return `${currentQuery} (regarding ${topic})`;
  }

  private getLastExchange(
    history: Message[],
  ): { userQuery: string; botResponse: string } | null {
    // Find the last user-bot pair
    const lastBotIdx = history
      .map((m, i) => ({ ...m, idx: i }))
      .filter((m) => m.role === 'assistant')
      .pop();

    if (!lastBotIdx) return null;

    // Find the user message before it
    const userBefore = history
      .slice(0, lastBotIdx.idx)
      .filter((m) => m.role === 'user')
      .pop();

    if (!userBefore) return null;

    return {
      userQuery: userBefore.content,
      botResponse: lastBotIdx.content,
    };
  }

  private extractTopic(exchange: {
    userQuery: string;
    botResponse: string;
  }): string | null {
    // Simple topic extraction from the previous question
    const topicPatterns: Record<string, string[]> = {
      'returns and refunds': ['return', 'refund', 'send back', 'exchange'],
      'shipping and delivery': [
        'ship',
        'deliver',
        'track',
        'arrival',
        'arrive',
      ],
      'payments and billing': [
        'pay',
        'charge',
        'bill',
        'credit',
        'price',
        'cost',
      ],
      'account management': ['account', 'password', 'login', 'sign', 'profile'],
      orders: ['order', 'purchase', 'buy', 'cancel'],
      'product information': ['product', 'item', 'size', 'color', 'stock'],
    };

    const combined =
      `${exchange.userQuery} ${exchange.botResponse}`.toLowerCase();

    for (const [topic, keywords] of Object.entries(topicPatterns)) {
      if (keywords.some((kw) => combined.includes(kw))) {
        return topic;
      }
    }

    // Fallback: use the original question as context
    return exchange.userQuery;
  }
}

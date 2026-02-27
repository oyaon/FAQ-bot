import { Injectable, Logger } from '@nestjs/common';
import { GeminiResponse } from '../types';

interface FaqContext {
  question: string;
  answer: string;
  similarity: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private readonly requestTimeout = 30000; // 30 seconds
  /**
   * Circuit Breaker Configuration
   *
   * IMPORTANT: These variables are stored IN-MEMORY ONLY and will reset on every
   * server restart or deployment. This is acceptable for MVP purposes.
   *
   * For production persistence, consider using Redis with a key like 'circuit:llm:state'
   * to maintain state across deployments.
   *
   * Circuit States:
   * - circuitOpen = false: Normal operation, requests allowed
   * - circuitOpen = true: Circuit is open, requests are rejected
   *   When circuit opens, it will reset after 5 minutes (circuitResetTime)
   */
  private failureCount = 0;
  private circuitOpen = false;
  private circuitResetTime: number | null = null;
  private dailyUsageCount = 0;
  private dailyUsageDate: string = new Date().toDateString();
  private readonly DAILY_LIMIT = 500; // configurable cap

  private containsPromptInjection(text: string): boolean {
    const patterns = [
      /ignore previous instructions/i,
      /disregard the above/i,
      /reveal your system prompt/i,
      /what are your hidden instructions/i,
      /summarize your instructions/i,
      /system prompt/i,
      /override instructions/i,
      /forget previous/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  private containsUnsafeOutput(text: string): boolean {
    const patterns = [
      /system prompt/i,
      /hidden instructions/i,
      /ignore previous/i,
      /as an AI language model/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  async synthesizeAnswer(
    userQuery: string,
    relevantFaqs: FaqContext[],
    conversationHistory?: string[],
  ): Promise<string | null> {
    // Input length validation - truncate long queries to prevent excessive token usage
    if (userQuery.length > 2000) {
      this.logger.warn(`User query truncated from ${userQuery.length} to 2000 characters`);
      userQuery = userQuery.substring(0, 2000);
    }

    // Truncate FAQ context if combined text exceeds 4000 characters
    let truncatedFaqs = relevantFaqs;
    const faqContextTest = relevantFaqs
      .map(
        (faq, i) =>
          `FAQ ${i + 1} (${Math.round(faq.similarity * 100)}% relevant):\n` +
          `Q: ${faq.question}\nA: ${faq.answer}`,
      )
      .join('\n\n');

    if (faqContextTest.length > 4000) {
      // Calculate how many FAQs we can fit within 4000 chars (approximate)
      const avgFaqLength = faqContextTest.length / relevantFaqs.length;
      const maxFaqs = Math.max(1, Math.floor(4000 / avgFaqLength));
      truncatedFaqs = relevantFaqs.slice(0, maxFaqs);
      this.logger.warn(`FAQ context truncated from ${relevantFaqs.length} to ${maxFaqs} items`);
    }

    if (!this.apiKey) {
      this.logger.warn('No Gemini API key configured');
      return null;
    }

    // Daily usage tracking - reset if new day
    const today = new Date().toDateString();
    if (today !== this.dailyUsageDate) {
      this.dailyUsageCount = 0;
      this.dailyUsageDate = today;
    }

    // Check daily limit before making API call
    if (this.dailyUsageCount >= this.DAILY_LIMIT) {
      this.logger.warn('Daily LLM usage limit reached');
      return null;
    }

    // Circuit breaker check
    if (this.circuitOpen) {
      if (this.circuitResetTime && Date.now() >= this.circuitResetTime) {
        this.failureCount = 0;
        this.circuitOpen = false;
        this.circuitResetTime = null;
        this.logger.log('Circuit breaker reset - reopening circuit');
      } else {
        this.logger.warn('Circuit breaker is open - rejecting request');
        return null;
      }
    }

    // Prompt injection detection - refuse without sanitizing
    if (this.containsPromptInjection(userQuery)) {
      this.logger.warn('Prompt injection attempt detected');
      return null;
    }

    const faqContext = truncatedFaqs
      .map(
        (faq, i) =>
          `FAQ ${i + 1} (${Math.round(faq.similarity * 100)}% relevant):\n` +
          `Q: ${faq.question}\nA: ${faq.answer}`,
      )
      .join('\n\n');

    const historyContext =
      conversationHistory && conversationHistory.length > 0
        ? `\nRecent conversation:\n${conversationHistory.join('\n')}\n`
        : '';

    const prompt = `You are a knowledgeable and friendly customer support specialist.

Your role: Answer customer questions using ONLY the FAQ information provided. Never invent information.

## Response Guidelines:
1. **Accuracy First**: Only use information from the provided FAQs
2. **Tone**: Friendly, professional, and helpful
3. **Structure**: Use bullet points or numbered lists for multi-step processes
4. **Length**: Keep responses under 150 words when possible
5. **Completeness**: If FAQs don't fully address the question, acknowledge this and suggest next steps
6. **Personalization**: Refer to "you" and "your" to make it conversational
7. **Action-Oriented**: Guide users toward solutions clearly and concisely

## If FAQs are insufficient:
Say exactly: "I can help with X, but for Y you'll need to contact our support team at support@company.com or call 1-800-XXX-XXXX"

## Example Response Pattern:
"Yes! Here's how to do this:
• Step 1: [from FAQ]
• Step 2: [from FAQ]
• Step 3: [from FAQ]
Questions? We're happy to help!"

${historyContext}

## Relevant FAQs for this question:
${faqContext}

---

Customer question: "${userQuery}"

Answer (friendly, direct, using only the FAQs above):`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.requestTimeout,
      );

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Gemini API error: ${response.status} - ${error}`);
        return null;
      }

      const data = (await response.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        this.logger.warn('Empty response from Gemini');
        return null;
      }

      // Output length guard - prevents runaway responses
      if (text.length > 1000) {
        this.logger.warn('LLM output too long - possible abuse');
        return null;
      }

      // Validate output safety
      if (this.containsUnsafeOutput(text)) {
        this.logger.warn('Unsafe output detected from LLM');
        return null;
      }

      // Reset circuit breaker on successful response
      this.failureCount = 0;

      // Increment daily usage count on success
      this.dailyUsageCount++;

      return text.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error('LLM API request timeout after 30s');
      } else {
        this.logger.error(
          `LLM synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Circuit breaker failure handling
      this.failureCount++;
      if (this.failureCount >= 5) {
        this.circuitOpen = true;
        this.circuitResetTime = Date.now() + 5 * 60 * 1000; // 5 minutes
        this.logger.error(
          `Circuit breaker opened after ${this.failureCount} failures. Will reset at ${new Date(this.circuitResetTime).toISOString()}`,
        );
      }

      return null;
    }
  }
}

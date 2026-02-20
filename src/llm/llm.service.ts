import { Injectable, Logger } from '@nestjs/common';

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

  async synthesizeAnswer(
    userQuery: string,
    relevantFaqs: FaqContext[],
    conversationHistory?: string[],
  ): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn('No Gemini API key configured');
      return null;
    }

    const faqContext = relevantFaqs
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

    const prompt = `You are a helpful customer support assistant. Answer the user's question using ONLY the FAQ information provided below. Do not make up information.

Rules:
- Be concise and friendly
- If the FAQs don't fully answer the question, say what you CAN answer and suggest contacting support for the rest
- Combine information from multiple FAQs when relevant
- Use bullet points for multi-step instructions
- Keep responses under 150 words
${historyContext}
Relevant FAQs:
${faqContext}

User question: "${userQuery}"

Answer:`;

    try {
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Gemini API error: ${error}`);
        return null;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        this.logger.warn('Empty response from Gemini');
        return null;
      }

      return text.trim();
    } catch (error) {
      this.logger.error(`LLM synthesis failed: ${error.message}`);
      return null;
    }
  }
}

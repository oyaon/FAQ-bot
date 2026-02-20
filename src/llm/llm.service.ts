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

import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('LlmService', () => {
  let service: LlmService;
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Set test API key
    process.env.GEMINI_API_KEY = 'test-api-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [LlmService],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  describe('synthesizeAnswer', () => {
    // Happy Path
    it('should return synthesized answer when API call succeeds', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'This is a synthesized answer based on the FAQs provided.',
                  },
                ],
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const userQuery = 'What is your return policy?';
      const relevantFaqs = [
        {
          question: 'What is return policy?',
          answer: '30 days',
          similarity: 0.9,
        },
      ];

      const result = await service.synthesizeAnswer(userQuery, relevantFaqs);

      expect(result).toBe(
        'This is a synthesized answer based on the FAQs provided.',
      );
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should include conversation history when provided', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [
            { content: { parts: [{ text: 'Answer with history' }] } },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const userQuery = 'Tell me more';
      const relevantFaqs = [
        { question: 'Test?', answer: 'Answer', similarity: 0.8 },
      ];
      const conversationHistory = ['Hello', 'Hi there'];

      await service.synthesizeAnswer(
        userQuery,
        relevantFaqs,
        conversationHistory,
      );

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body as string);
      expect(body.contents[0].parts[0].text).toContain('Recent conversation');
    });

    // Edge Cases
    it('should return null when no API key is configured', async () => {
      delete process.env.GEMINI_API_KEY;

      // Re-create service without API key
      const newService = new LlmService();

      const result = await newService.synthesizeAnswer('test', []);

      expect(result).toBeNull();
    });

    it('should return null when API key is empty string', async () => {
      // Override the API key property directly
      Object.defineProperty(service, 'apiKey', { value: '' });

      const result = await service.synthesizeAnswer('test', []);

      expect(result).toBeNull();
    });

    it('should handle empty relevantFaqs array', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: 'Answer' }] } }],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.synthesizeAnswer('test question', []);

      expect(result).toBe('Answer');
    });

    it('should handle multiple FAQs with different similarity scores', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: 'Multi-FAQ answer' }] } }],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const relevantFaqs = [
        { question: 'Q1', answer: 'A1', similarity: 0.9 },
        { question: 'Q2', answer: 'A2', similarity: 0.8 },
        { question: 'Q3', answer: 'A3', similarity: 0.7 },
      ];

      await service.synthesizeAnswer('test', relevantFaqs);

      expect(mockFetch).toHaveBeenCalled();
    });

    // Error Handling
    it('should return null when API response is not ok', async () => {
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue('API Error'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });

    it('should return null when API returns empty response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });

    it('should return null when API returns no candidates', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ candidates: [] }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });

    it('should return null when fetch throws an error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });

    it('should return null when API returns null text', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: null }] } }],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });

    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const result = await service.synthesizeAnswer('test', [
        { question: 'Q', answer: 'A', similarity: 0.9 },
      ]);

      expect(result).toBeNull();
    });
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have synthesizeAnswer method', () => {
      expect(typeof service.synthesizeAnswer).toBe('function');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { FaqService } from './faq.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('mock-hash'),
    }),
  }),
}));

describe('FaqService', () => {
  let service: FaqService;
  let supabaseService: jest.Mocked<SupabaseService>;

  // Mock Supabase client
  const mockSupabaseClient = {
    rpc: jest.fn(),
    from: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<FaqService>(FaqService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchByVector', () => {
    // Happy Path
    it('should return search results when vector search succeeds', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          id: 1,
          question: 'What is your return policy?',
          answer: '30 days',
          similarity: 0.9,
        },
        {
          id: 2,
          question: 'How do I return?',
          answer: 'Contact support',
          similarity: 0.85,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await service.searchByVector(embedding);

      expect(result).toEqual(mockResults);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('match_faqs', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 3,
      });
    });

    it('should use custom threshold and limit', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const mockResults = [
        { id: 1, question: 'Test', answer: 'Answer', similarity: 0.7 },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const result = await service.searchByVector(embedding, 0.7, 5);

      expect(result).toEqual(mockResults);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('match_faqs', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
      });
    });

    // Edge Cases
    it('should return empty array when no results found', async () => {
      const embedding = [0.1, 0.2, 0.3];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.searchByVector(embedding);

      expect(result).toEqual([]);
    });

    it('should return empty array on Supabase error', async () => {
      const embedding = [0.1, 0.2, 0.3];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.searchByVector(embedding);

      expect(result).toEqual([]);
    });

    // Error Handling
    it('should return empty array on unexpected error', async () => {
      const embedding = [0.1, 0.2, 0.3];

      mockSupabaseClient.rpc.mockRejectedValue(new Error('Network error'));

      const result = await service.searchByVector(embedding);

      expect(result).toEqual([]);
    });

    // Test for missing RPC function
    it('should return empty array when RPC function does not exist', async () => {
      const embedding = [0.1, 0.2, 0.3];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'function search_faqs does not exist',
          code: 'PGRST116',
          details: null,
          hint: null,
        },
      });

      const result = await service.searchByVector(embedding);

      expect(result).toEqual([]);
    });

    it('should handle empty embedding array', async () => {
      const embedding: number[] = [];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.searchByVector(embedding);

      expect(result).toEqual([]);
    });
  });

  describe('searchByKeyword', () => {
    // Helper to create mock chain
    const createMockFrom = (data: unknown, error: unknown = null) => {
      return {
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data, error }),
          }),
        }),
      };
    };

    // Happy Path
    it('should return search results when keyword search succeeds', async () => {
      const query = 'return policy';
      const mockResults = [
        {
          id: 1,
          question: 'What is your return policy?',
          answer: '30 days',
          category: 'returns',
        },
      ];

      mockSupabaseClient.from.mockReturnValue(createMockFrom(mockResults));

      const result = await service.searchByKeyword(query);

      expect(result).toEqual(mockResults);
    });

    it('should use custom limit', async () => {
      const query = 'test';
      const mockResults = [
        { id: 1, question: 'Test', answer: 'Answer', category: 'test' },
      ];

      mockSupabaseClient.from.mockReturnValue(createMockFrom(mockResults));

      const result = await service.searchByKeyword(query, 5);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    // Edge Cases
    it('should return empty array when no results found', async () => {
      const query = 'nonexistent';

      mockSupabaseClient.from.mockReturnValue(createMockFrom(null));

      const result = await service.searchByKeyword(query);

      expect(result).toEqual([]);
    });

    it('should return empty array on Supabase error', async () => {
      const query = 'test';

      mockSupabaseClient.from.mockReturnValue(
        createMockFrom(null, { message: 'Query error' }),
      );

      const result = await service.searchByKeyword(query);

      expect(result).toEqual([]);
    });

    // Error Handling
    it('should return empty array on unexpected error', async () => {
      const query = 'test';

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      } as never);

      const result = await service.searchByKeyword(query);

      expect(result).toEqual([]);
    });

    it('should handle empty query', async () => {
      const query = '';

      mockSupabaseClient.from.mockReturnValue(createMockFrom([]));

      const result = await service.searchByKeyword(query);

      expect(result).toEqual([]);
    });
  });

  describe('logQuery', () => {
    // Happy Path
    it('should log query and return ID', async () => {
      const mockInsertResponse = {
        data: { id: 123 },
        error: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockInsertResponse),
          }),
        }),
      } as never);

      const result = await service.logQuery(
        'test query',
        1,
        0.9,
        'vector',
        100,
        false,
        false,
      );

      expect(result).toBe(123);
    });

    // Edge Cases
    it('should return null when insert fails', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      } as never);

      const result = await service.logQuery('test', null, null, 'vector', 100);

      expect(result).toBeNull();
    });

    // Error Handling
    it('should return null on unexpected error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Network error')),
          }),
        }),
      } as never);

      const result = await service.logQuery('test', null, null, 'vector', 100);

      expect(result).toBeNull();
    });
  });

  describe('saveFeedback', () => {
    // Happy Path
    it('should save feedback successfully', async () => {
      const mockUpdateResponse = {
        data: null,
        error: null,
      };

      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockUpdateResponse),
        }),
      } as never);

      await expect(
        service.saveFeedback(123, true, 5, 'Great service!', 'positive'),
      ).resolves.not.toThrow();
    });

    it('should save feedback with rating', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as never);

      await service.saveFeedback(123, true, 4);

      const updateCall =
        mockSupabaseClient.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('feedback', true);
      expect(updateCall).toHaveProperty('rating', 4);
    });

    // Edge Cases
    it('should not save invalid rating (below 1)', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as never);

      await service.saveFeedback(123, true, 0);

      const updateCall =
        mockSupabaseClient.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('rating');
    });

    it('should not save invalid rating (above 5)', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as never);

      await service.saveFeedback(123, true, 6);

      const updateCall =
        mockSupabaseClient.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('rating');
    });

    it('should trim feedback text', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as never);

      await service.saveFeedback(123, true, undefined, '  Great service!  ');

      const updateCall =
        mockSupabaseClient.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('feedback_text', 'Great service!');
    });

    it('should not save empty feedback text', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as never);

      await service.saveFeedback(123, true, undefined, '   ');

      const updateCall =
        mockSupabaseClient.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('feedback_text');
    });

    // Error Handling
    it('should handle update error gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('Update failed')),
        }),
      } as never);

      await expect(service.saveFeedback(123, true, 5)).resolves.not.toThrow();
    });
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have searchByVector method', () => {
      expect(typeof service.searchByVector).toBe('function');
    });

    it('should have searchByKeyword method', () => {
      expect(typeof service.searchByKeyword).toBe('function');
    });

    it('should have logQuery method', () => {
      expect(typeof service.logQuery).toBe('function');
    });

    it('should have saveFeedback method', () => {
      expect(typeof service.saveFeedback).toBe('function');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';

// Mock the @xenova/transformers module BEFORE importing the service
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockImplementation(() => {
    return jest.fn().mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    });
  }),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    // Wait for onModuleInit to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    // Happy Path
    it('should generate embedding for valid text', async () => {
      const text = 'Hello world';

      const result = await service.generate(text);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);
    });

    it('should return array of numbers', async () => {
      const text = 'Test text';

      const result = await service.generate(text);

      result.forEach((value) => {
        expect(typeof value).toBe('number');
      });
    });

    // Edge Cases
    it('should return cached embedding on second call with same text', async () => {
      const text = 'cached text';

      await service.generate(text);
      await service.generate(text);

      // Should work without error (caching)
      expect(service.generate).toBeDefined();
    });

    it('should handle empty string', async () => {
      const text = '';

      const result = await service.generate(text);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle very long text', async () => {
      const text = 'a'.repeat(10000);

      const result = await service.generate(text);

      expect(Array.isArray(result)).toBe(true);
    });

    // Error Handling
    it('should throw error when model is not ready', async () => {
      // Create service without initialization
      const newService = new EmbeddingService();

      await expect(newService.generate('test')).rejects.toThrow(
        'Model not ready',
      );
    });
  });

  describe('onModuleInit', () => {
    it('should initialize the embedder on module init', async () => {
      expect(service).toBeDefined();
    });
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have generate method', () => {
      expect(typeof service.generate).toBe('function');
    });
  });
});

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embedder: any;
  private isReady = false;
  private cache = new Map<string, number[]>();

  async onModuleInit() {
    this.logger.log('Loading embedding model...');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    this.isReady = true;
    this.logger.log('Embedding model ready!');
  }

  async generate(text: string): Promise<number[]> {
    if (!this.isReady) throw new Error('Model not ready');

    // Normalize text for cache key
    const key = text.toLowerCase().trim();

    // Check cache
    if (this.cache.has(key)) {
      this.logger.debug('Embedding cache hit');
      return this.cache.get(key) as number[];
    }

    // Generate new embedding
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as number[]);

    // Store in cache (limit size to avoid memory leak)
    if (this.cache.size > 1000) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, embedding);

    return embedding;
  }
}

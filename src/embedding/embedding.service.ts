import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: any = null;

  async onModuleInit() {
    try {
      this.logger.log('Loading embedding model (first run may take 1-2 minutes)...');
      // Load the feature extraction pipeline
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      );
      this.logger.log('Embedding model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  async generate(text: string): Promise<number[]> {
    try {
      if (!this.extractor) {
        throw new Error('Embedding model not initialized');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Cannot generate embedding for empty text');
      }

      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      return Array.from(output.data);
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.extractor = null;
    // this.cache.clear(); // Note: code from prompt suggests `this.cache.clear()` but it isn't defined here, leaving it out or I'll implement it if there's a cache
  }
}

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { pipeline, Pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: Pipeline | null = null;
  private isModelReady = false;

  async onModuleInit() {
    try {
      this.logger.log(
        'Loading embedding model (first run may take 1-2 minutes)...',
      );
      // Load the feature extraction pipeline
      // Using type assertion to handle the @xenova/transformers type mismatch
      this.extractor = (await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      )) as unknown as Pipeline;
      this.isModelReady = true;
      this.logger.log('Embedding model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  /**
   * Check if the embedding model is ready
   */
  public isReady(): boolean {
    return this.isModelReady && this.extractor !== null;
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

  async onModuleDestroy(): Promise<void> {
    this.extractor = null;
  }
}

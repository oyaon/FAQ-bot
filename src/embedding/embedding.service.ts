import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embedder: any;
  private isReady = false;

  async onModuleInit() {
    this.logger.log('Loading embedding model...');
    const { pipeline } = await import('@xenova/transformers');
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    this.isReady = true;
    this.logger.log('Embedding model ready!');
  }

  async generate(text: string): Promise<number[]> {
    if (!this.isReady) throw new Error('Model not ready');
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}
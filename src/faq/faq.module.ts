import { Module } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [EmbeddingModule, ConversationModule, LlmModule],
  providers: [FaqService],
  controllers: [FaqController],
})
export class FaqModule {}
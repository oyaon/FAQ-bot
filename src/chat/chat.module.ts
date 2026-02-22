import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { FaqModule } from '../faq/faq.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { LlmModule } from '../llm/llm.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [FaqModule, EmbeddingModule, LlmModule, SupabaseModule, ConversationModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}

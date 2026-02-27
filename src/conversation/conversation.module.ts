import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ContextRewriterService } from './context-rewriter.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [ConversationService, ContextRewriterService],
  exports: [ConversationService, ContextRewriterService],
})
export class ConversationModule {}

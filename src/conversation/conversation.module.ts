import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ContextRewriterService } from './context-rewriter.service';

@Module({
  providers: [ConversationService, ContextRewriterService],
  exports: [ConversationService, ContextRewriterService],
})
export class ConversationModule {}

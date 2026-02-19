import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  processMessage(message: string, sessionId?: string) {
    this.logger.log(`Processing message: ${message}`);

    // For now, return a simple response
    // This can be extended to integrate with the FAQ service
    return {
      message: 'Chat endpoint received your message',
      sessionId,
      originalMessage: message,
    };
  }
}


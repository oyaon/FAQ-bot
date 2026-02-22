import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { v4 as uuidv4 } from 'uuid';

export class ChatRequestDto {
  sessionId?: string;
  message: string;
}

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 messages per minute
  async chat(@Body() dto: ChatRequestDto) {
    // Generate or use provided sessionId
    let sessionId = dto.sessionId;
    if (!sessionId) {
      sessionId = uuidv4();
    }

    // Process the message through the chat service
    const response = await this.chatService.processMessage(sessionId, dto.message);

    return response;
  }
}

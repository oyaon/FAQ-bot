import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { v4 as uuidv4 } from 'uuid';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class ChatRequestDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
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
    const response = await this.chatService.processMessage(
      sessionId,
      dto.message,
    );

    return response;
  }
}

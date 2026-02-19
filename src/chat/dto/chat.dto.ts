import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

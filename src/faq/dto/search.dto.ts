import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional, IsUUID } from 'class-validator';

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  query: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}


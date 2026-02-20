import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  query: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

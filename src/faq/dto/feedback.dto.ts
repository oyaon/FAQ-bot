import { IsNumber, IsBoolean } from 'class-validator';

export class FeedbackDto {
  @IsNumber()
  queryLogId: number;

  @IsBoolean()
  helpful: boolean;
}


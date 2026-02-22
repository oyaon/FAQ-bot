import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class FeedbackDto {
  @IsNumber()
  queryLogId: number;

  @IsBoolean()
  helpful: boolean;

  @IsOptional()
  @IsNumber()
  rating?: number; // 1-5 star rating

  @IsOptional()
  @IsString()
  feedback?: string; // Custom feedback text

  @IsOptional()
  @IsIn(['accurate', 'incomplete', 'unclear', 'irrelevant', 'outdated'])
  feedbackType?: string; // Type of feedback
}

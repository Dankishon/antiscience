import { IsString, MinLength } from 'class-validator';

export class CreateResponseDto {
  @IsString()
  @MinLength(1)
  surveyId!: string;
}

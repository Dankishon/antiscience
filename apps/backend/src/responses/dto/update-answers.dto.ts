import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ResponseAnswerInputDto {
  @IsString()
  @MinLength(1)
  questionCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  value!: number;
}

export class UpdateAnswersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ResponseAnswerInputDto)
  answers!: ResponseAnswerInputDto[];
}

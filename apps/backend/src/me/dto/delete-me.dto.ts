import { Equals, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteMeDto {
  @Equals('DELETE')
  confirmation!: 'DELETE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

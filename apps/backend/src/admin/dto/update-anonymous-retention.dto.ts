import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAnonymousRetentionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  runCleanup?: boolean;
}

import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class AttachFlowerAssetDto {
  @IsString()
  @MinLength(1)
  kind!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsString()
  @MinLength(1)
  storageKey!: string;

  @IsOptional()
  @IsString()
  publicUrl?: string;

  @IsString()
  @MinLength(1)
  mimeType!: string;

  @IsIn(['private', 'internal', 'public'])
  visibility!: 'private' | 'internal' | 'public';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

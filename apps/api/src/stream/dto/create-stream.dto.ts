import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStreamDto {
  @IsString()
  name!: string;

  @IsUrl()
  primaryUrl!: string;

  @IsOptional()
  @IsUrl()
  backupUrl?: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsString()
  tvgId?: string;

  @IsOptional()
  @IsString()
  tvgLogo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsIn(['PROXY', 'TRANSCODE'])
  streamMode?: string = 'PROXY';

  // ─── TMDB / VOD metadata (manuel düzenlenebilir) ───────────────────────────
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tmdbId?: number;

  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  posterUrl?: string; // @IsUrl DEĞİL — esnek (tvgLogo gibi)

  @IsOptional()
  @IsString()
  backdropUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  releaseYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tmdbRating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tmdbGenres?: string[];
}

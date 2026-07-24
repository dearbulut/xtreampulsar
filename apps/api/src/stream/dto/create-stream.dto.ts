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

  @IsOptional()
  @IsUrl()
  primaryUrl?: string;

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
  @IsIn(['PROXY', 'TRANSCODE', 'LOOP'])
  streamMode?: string = 'PROXY';

  @IsOptional()
  @IsBoolean()
  isRadio?: boolean;

  // ─── LOOP modu (24/7 sahte-canli kanal) ────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  loopSources?: string[];

  @IsOptional()
  @IsBoolean()
  loopShuffle?: boolean;

  // ─── Catch-up / DVR ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  catchupEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  catchupDays?: number;

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

  // ─── Gelismis akis ayarlari (roadmap B) ───────────────────────────────────
  @IsOptional() @IsBoolean()
  directSource?: boolean;

  @IsOptional() @IsString()
  streamUserAgent?: string;

  @IsOptional() @IsString()
  httpProxy?: string;

  @IsOptional() @IsString()
  httpCookie?: string;

  @IsOptional() @IsString()
  httpHeaders?: string;

  @IsOptional() @IsString()
  customFfmpeg?: string;

  @IsOptional() @IsString()
  customMap?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  probeSize?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  delayMinutes?: number;

  @IsOptional() @IsString()
  transcodeProfile?: string;

  @IsOptional() @IsBoolean()
  generatePts?: boolean;

  @IsOptional() @IsBoolean()
  allowRecording?: boolean;

  @IsOptional() @IsBoolean()
  allowRtmpOutput?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  restartDays?: string[];

  @IsOptional() @IsString()
  restartTime?: string;

  @IsOptional() @IsString()
  epgSourceId?: string;

  @IsOptional() @IsString()
  epgLang?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  cast?: string[];

  @IsOptional() @IsString()
  director?: string;

  @IsOptional() @IsString()
  subtitlePath?: string;

  @IsOptional() @IsString()
  targetContainer?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  durationSecs?: number;
}

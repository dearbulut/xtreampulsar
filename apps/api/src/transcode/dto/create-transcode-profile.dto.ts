import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AbrVariantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  videoBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  audioBitrate?: number;
}

export class CreateTranscodeProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // --- video ---
  @IsOptional()
  @IsString()
  videoCodec?: string;

  @IsOptional()
  @IsString()
  videoPreset?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  videoBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bufSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(51)
  crf?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  fps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gopSize?: number;

  @IsOptional()
  @IsString()
  pixFmt?: string;

  @IsOptional()
  @IsString()
  videoProfile?: string;

  @IsOptional()
  @IsString()
  videoTune?: string;

  // --- audio ---
  @IsOptional()
  @IsString()
  audioCodec?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  audioBitrate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  audioChannels?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(8000)
  audioRate?: number;

  // --- hls ---
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  hlsSegmentSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  hlsListSize?: number;

  @IsOptional()
  @IsBoolean()
  hlsDeleteSegments?: boolean;

  // --- abr ---
  @IsOptional()
  @IsBoolean()
  abrEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbrVariantDto)
  abrVariants?: AbrVariantDto[];

  // --- misc ---
  @IsOptional()
  @IsString()
  hwAccel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(64)
  threads?: number;

  @IsOptional()
  @IsString()
  extraArgs?: string;
}

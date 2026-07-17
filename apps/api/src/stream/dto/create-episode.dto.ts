import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEpisodeDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  season!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  episode!: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  primaryUrl!: string; // @IsUrl DEĞİL — esnek

  @IsOptional()
  @IsString()
  containerExtension?: string;

  @IsOptional()
  @IsString()
  plot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationSecs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tmdbRating?: number;

  @IsOptional()
  @IsString()
  releaseDate?: string;

  @IsOptional()
  @IsString()
  cover?: string;
}

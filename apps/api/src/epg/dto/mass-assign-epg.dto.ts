import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MassAssignEpgDto {
  @IsString()
  epgSourceId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number = 0.6;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stripPrefixes?: string[] = [];
}

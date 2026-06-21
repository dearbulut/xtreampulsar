import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEpgSourceDto {
  @IsString()
  name!: string;

  @IsUrl()
  xmltvUrl!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  daysToKeep?: number = 7;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

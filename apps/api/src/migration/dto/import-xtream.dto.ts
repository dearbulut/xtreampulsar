import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportXtreamDto {
  @IsUrl()
  serverUrl!: string;

  @IsString()
  username!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsBoolean()
  importLive?: boolean = true;

  @IsOptional()
  @IsBoolean()
  importVod?: boolean = true;

  @IsOptional()
  @IsBoolean()
  importSeries?: boolean = false;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;

  @IsOptional()
  @IsIn(['SKIP', 'OVERWRITE', 'MERGE'])
  conflictMode?: 'SKIP' | 'OVERWRITE' | 'MERGE';
}

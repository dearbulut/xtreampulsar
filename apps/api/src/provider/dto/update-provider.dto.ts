import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateProviderDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  userAgent?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsBoolean()
  autoSync?: boolean;

  @IsOptional() @IsInt() @Min(15) @Max(43200)
  syncIntervalMinutes?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  skipKeywords?: string[];

  @IsOptional() @IsIn(['KEEP', 'DISABLE', 'DELETE'])
  dropPolicy?: string;

  @IsOptional() @IsIn(['ts', 'm3u8'])
  outputExt?: string;

  @IsOptional() @IsString()
  mirrorBouquetId?: string;

  @IsOptional() @IsString()
  mirrorServerId?: string;

  @IsOptional() @IsBoolean()
  importLive?: boolean;

  @IsOptional() @IsBoolean()
  importVod?: boolean;

  @IsOptional() @IsBoolean()
  importSeries?: boolean;
}

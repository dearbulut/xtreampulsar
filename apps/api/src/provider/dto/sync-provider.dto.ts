import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SyncProviderDto {
  @IsOptional()
  @IsString()
  bouquetId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsIn(['ts', 'm3u8'])
  outputExt?: string;

  @IsOptional()
  @IsIn(['KEEP', 'DISABLE', 'DELETE'])
  dropPolicy?: string;

  @IsOptional()
  @IsBoolean()
  importLive?: boolean;

  @IsOptional()
  @IsBoolean()
  importVod?: boolean;

  @IsOptional()
  @IsBoolean()
  importSeries?: boolean;

  // Boş/verilmezse ilgili tipin TÜM kategorileri aynalanır.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  liveCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vodCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seriesCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skipKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(43200)
  syncIntervalMinutes?: number;
}

import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ImportM3uDto {
  @IsOptional()
  @IsIn(['LIVE', 'VOD', 'SERIES'])
  defaultType?: string = 'LIVE';

  @IsOptional()
  @IsString()
  defaultBouquetId?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = false;
}

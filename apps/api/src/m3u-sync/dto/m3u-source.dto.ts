import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateM3uSourceDto {
  @IsString() @MinLength(1)
  name!: string;

  @IsString() @MinLength(1)
  url!: string;

  @IsOptional() @IsIn(['LIVE', 'VOD', 'SERIES'])
  defaultType?: string;

  @IsOptional() @IsString()
  defaultBouquetId?: string;

  @IsOptional() @IsIn(['SKIP', 'OVERWRITE', 'MERGE'])
  conflictMode?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsInt() @Min(5)
  intervalMinutes?: number;
}

export class UpdateM3uSourceDto extends CreateM3uSourceDto {}

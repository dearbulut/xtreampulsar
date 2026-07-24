import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class WatchConfigDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsString()
  path?: string;

  @IsOptional() @IsString()
  bouquetId?: string;

  @IsOptional() @IsInt() @Min(1) @Max(1440)
  intervalMins?: number;
}

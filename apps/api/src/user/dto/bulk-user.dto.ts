import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkExtendDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;
}

export class BulkDeleteDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];
}

export class ExtendDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;
}

export class BulkActionDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @IsString()
  action!: string;

  @IsOptional()
  value?: string | number;
}

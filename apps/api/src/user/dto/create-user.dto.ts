import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConnections?: number = 1;

  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  resellerId?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'RESELLER', 'USER'])
  role?: string = 'USER';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  packageId?: string;
}

import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateResellerDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir',
  })
  password?: string;

  @IsOptional()
  @IsIn(['BASIC', 'SILVER', 'GOLD', 'PLATINUM'])
  tier?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxUsers?: number;

  @IsOptional()
  @IsString()
  badgeText?: string | null;

  @IsOptional()
  @IsString()
  badgeColor?: string | null;

  @IsOptional()
  @IsIn(['CREDITS', 'USERS'])
  billingModel?: string;

  @IsOptional()
  @IsString()
  slotsValidUntil?: string | null;
}

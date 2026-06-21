import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResellerDto {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credits?: number = 0;

  @IsOptional()
  @IsIn(['BASIC', 'SILVER', 'GOLD', 'PLATINUM'])
  tier?: string = 'BASIC';

  @IsOptional()
  @IsString()
  parentId?: string;
}

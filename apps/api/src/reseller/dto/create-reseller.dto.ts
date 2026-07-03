import {
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

export class CreateResellerDto {
  @IsString()
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir',
  })
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

  @IsOptional()
  @IsString()
  notes?: string;
}

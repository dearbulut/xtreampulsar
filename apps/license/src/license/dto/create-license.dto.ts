import { IsString, IsNotEmpty, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum LicenseTierDto {
  STARTER = 'STARTER',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  WHITE_LABEL = 'WHITE_LABEL',
}

export class CreateLicenseDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsEnum(LicenseTierDto)
  tier!: LicenseTierDto;

  @IsDateString()
  expiresAt!: string;

  @IsString()
  @IsOptional()
  serverIp?: string;
}

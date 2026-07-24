import { IsArray, IsBoolean, IsHexColor, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateWidgetDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsIn(['TRIAL', 'STORE', 'RENEWAL'])
  type?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  subtitle?: string;

  @IsOptional() @IsHexColor()
  accentColor?: string;

  @IsOptional() @IsString()
  trialPackageId?: string;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  trialDurationDays?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  allowedPackageIds?: string[];

  @IsOptional() @IsString()
  successMessage?: string;

  @IsOptional() @IsString()
  redirectUrl?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  perIpDailyLimit?: number;
}

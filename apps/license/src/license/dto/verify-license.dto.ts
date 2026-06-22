import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyLicenseDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  serverIp!: string;

  @IsString()
  @IsNotEmpty()
  version!: string;
}

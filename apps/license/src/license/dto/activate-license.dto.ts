import { IsString, IsNotEmpty } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  serverIp!: string;
}

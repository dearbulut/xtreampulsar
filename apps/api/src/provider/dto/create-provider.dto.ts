import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  // Xtream tam URL'i (get.php / player_api.php) — host/user/pass buradan parse edilir.
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsIn(['XTREAM', 'M3U'])
  type?: string;
}

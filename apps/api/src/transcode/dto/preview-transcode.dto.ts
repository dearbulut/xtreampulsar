import { IsOptional, IsString } from 'class-validator';

/** Onizleme icin: kaydedilmemis profil ayarlarini da deneyebilmek adina govde opsiyonel. */
export class PreviewTranscodeDto {
  /** Ornek girdi URL'si (bos ise ornek bir URL kullanilir). */
  @IsOptional()
  @IsString()
  inputUrl?: string;

  /** Belirtilirse bu akisin ayarlari (userAgent/headers/customFfmpeg) da uygulanir. */
  @IsOptional()
  @IsString()
  streamId?: string;
}

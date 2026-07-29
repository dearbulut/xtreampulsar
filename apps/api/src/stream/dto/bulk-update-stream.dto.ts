import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Toplu duzenlemede hedef kumeyi belirleyen filtre. Yayin listesindeki
 * filtrelerin AYNISI; boylece kullanici ekranda ne goruyorsa ona uygulanir.
 * 14 bin kanali tek tek secmek mumkun olmadigi icin "filtreye uyan hepsi"
 * modu bu nesne uzerinden calisir.
 */
export class BulkStreamFilterDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  categoryId?: string;

  @IsOptional() @IsString()
  serverId?: string;

  @IsOptional() @IsString()
  providerId?: string;

  @IsOptional() @IsIn(['LIVE', 'VOD', 'SERIES'])
  type?: string;

  @IsOptional() @IsIn(['ONLINE', 'OFFLINE', 'BUFFERING', 'ERROR'])
  status?: string;

  @IsOptional() @IsIn(['HEALTHY', 'UNHEALTHY', 'UNKNOWN'])
  healthStatus?: string;

  @IsOptional() @IsIn(['PROXY', 'TRANSCODE', 'LOOP'])
  streamMode?: string;

  @IsOptional() @IsBoolean()
  isRadio?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

/** Uygulanacak degisiklikler. Verilmeyen alanlara DOKUNULMAZ. */
export class BulkStreamDataDto {
  @IsOptional() @IsIn(['PROXY', 'TRANSCODE', 'LOOP'])
  streamMode?: string;

  /** Bos string => profili kaldir (null). */
  @IsOptional() @IsString()
  transcodeProfileId?: string;

  @IsOptional() @IsString()
  categoryId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsString()
  streamUserAgent?: string;

  @IsOptional() @IsString()
  httpHeaders?: string;

  @IsOptional() @IsString()
  httpCookie?: string;
}

export class BulkUpdateStreamsDto {
  /** Acikca secilen yayinlar. Doluysa filtre yok sayilir. */
  @IsOptional() @IsArray() @IsString({ each: true })
  streamIds?: string[];

  /** streamIds bos ise kullanilir. */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => BulkStreamFilterDto)
  filter?: BulkStreamFilterDto;

  /**
   * Ne streamIds ne de daraltici bir filtre verilmisse hedef = TUM katalog.
   * Kazara 14 bin kanali ezmemek icin bu durumda acik onay sart.
   */
  @IsOptional() @IsBoolean()
  confirmAll?: boolean;

  @IsObject() @ValidateNested() @Type(() => BulkStreamDataDto)
  data!: BulkStreamDataDto;
}

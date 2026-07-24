import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryStreamDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE', 'BUFFERING', 'ERROR'])
  status?: string;

  @IsOptional()
  @IsIn(['LIVE', 'VOD', 'SERIES'])
  type?: string;

  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  isRadio?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C', 'D', 'F'])
  qualityScore?: string;

  @IsOptional()
  @IsIn(['HEALTHY', 'UNHEALTHY', 'UNKNOWN'])
  healthStatus?: string;

  @IsOptional()
  @IsString()
  videoCodec?: string;

  @IsOptional()
  @IsString()
  updatedAfter?: string;
}

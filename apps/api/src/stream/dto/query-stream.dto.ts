import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryStreamDto extends PaginationDto {
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
}

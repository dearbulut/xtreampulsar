import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryUserDto extends PaginationDto {
  @IsOptional()
  @IsString()
  resellerId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED', 'EXPIRED', 'BANNED'])
  status?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expiring_soon?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isTrial?: boolean;
}

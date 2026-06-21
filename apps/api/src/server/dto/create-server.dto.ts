import {
  IsIn,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServerDto {
  @IsString()
  name!: string;

  @IsIP()
  ip!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number = 8080;

  @IsOptional()
  @IsIn(['MAIN', 'LOAD_BALANCER'])
  role?: 'MAIN' | 'LOAD_BALANCER' = 'MAIN';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxClients?: number = 1000;

  @IsOptional()
  @IsString()
  location?: string;
}

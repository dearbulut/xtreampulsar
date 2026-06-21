import { PartialType } from '@nestjs/mapped-types';
import { CreateServerDto } from './create-server.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateServerDto extends PartialType(CreateServerDto) {
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}

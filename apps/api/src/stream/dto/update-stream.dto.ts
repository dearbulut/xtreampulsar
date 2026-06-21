import { PartialType } from '@nestjs/mapped-types';
import { CreateStreamDto } from './create-stream.dto';
import { IsIn, IsOptional } from 'class-validator';

export class UpdateStreamDto extends PartialType(CreateStreamDto) {
  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE', 'BUFFERING', 'ERROR'])
  status?: string;
}

import { IsString } from 'class-validator';

export class CreateEpgMappingDto {
  @IsString()
  streamId!: string;

  @IsString()
  epgSourceId!: string;

  @IsString()
  epgChannelId!: string;
}

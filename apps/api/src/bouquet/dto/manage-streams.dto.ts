import { IsArray, IsString } from 'class-validator';

export class ManageStreamsDto {
  @IsArray()
  @IsString({ each: true })
  streamIds!: string[];
}

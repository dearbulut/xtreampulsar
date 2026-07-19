import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientRequestDto {
  @IsIn(['REPORT', 'NEW_CHANNEL'])
  type!: 'REPORT' | 'NEW_CHANNEL';

  @IsOptional()
  @IsString()
  streamId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

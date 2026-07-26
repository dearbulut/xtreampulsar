import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class AssignProfileDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  streamIds!: string[];

  /** null/bos ⇒ profili kaldir */
  @IsOptional()
  @IsString()
  profileId?: string | null;
}

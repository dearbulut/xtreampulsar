import { PartialType } from '@nestjs/mapped-types';
import { CreateTranscodeProfileDto } from './create-transcode-profile.dto';

export class UpdateTranscodeProfileDto extends PartialType(
  CreateTranscodeProfileDto,
) {}

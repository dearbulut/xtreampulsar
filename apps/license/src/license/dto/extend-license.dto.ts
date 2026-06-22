import { IsInt, Min } from 'class-validator';

export class ExtendLicenseDto {
  @IsInt()
  @Min(1)
  days!: number;
}

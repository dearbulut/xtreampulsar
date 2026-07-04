import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Reseller → sub-reseller transfer. Target is the :subId URL param; only the
// amount is in the body. @Min(1) blocks negative/zero (K2 credit-theft).
export class TransferCreditsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}

// Admin transfer between two arbitrary resellers; target id is in the body.
export class AdminTransferCreditsDto {
  @IsString()
  @IsNotEmpty()
  toResellerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;
}

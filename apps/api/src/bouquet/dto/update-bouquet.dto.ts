import { PartialType } from '@nestjs/mapped-types';
import { CreateBouquetDto } from './create-bouquet.dto';

export class UpdateBouquetDto extends PartialType(CreateBouquetDto) {}

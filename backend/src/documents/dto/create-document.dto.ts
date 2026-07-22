import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '@/common/enums';

export class CreateDocumentItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  thirdPartyId?: string;

  // Solo se envía para type === T (traslado); el resto de tipos siempre
  // opera sobre la tienda activa, resuelta por el service.
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  destWarehouseId?: string;

  @IsOptional()
  @IsUUID()
  destBinId?: string;

  @IsOptional()
  @IsUUID()
  sourceBinId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  freight?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentItemDto)
  items!: CreateDocumentItemDto[];
}

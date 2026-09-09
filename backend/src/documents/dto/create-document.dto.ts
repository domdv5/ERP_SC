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
import {
  DocumentType,
  EaiAdjustmentReason,
  PaymentMethod,
} from '@/common/enums';

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

  // Solo se usa y se guarda en los tipos valorados a precio de venta
  // (preventas, remisiones y ventas).
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

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

  // Solo se envía y valida en preventas y remisiones; debe ser un tercero marcado como vendedora.
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  // Solo se envía en traslados; el resto de tipos siempre opera sobre la tienda
  // activa, que resuelve el service.
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
  @IsString()
  notes?: string;

  // Solo se envía y valida en entradas por ajuste.
  @IsOptional()
  @IsEnum(EaiAdjustmentReason)
  adjustmentReason?: EaiAdjustmentReason;

  // Obligatorio solo cuando el motivo del ajuste es "otro".
  @IsOptional()
  @IsString()
  @MaxLength(300)
  adjustmentReasonOther?: string;

  // Solo se envía y valida en ventas de contado.
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentItemDto)
  items!: CreateDocumentItemDto[];
}

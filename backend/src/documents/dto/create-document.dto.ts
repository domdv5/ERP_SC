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
  DvvRefundMethod,
  EaiAdjustmentReason,
  PaymentMethod,
} from '@/common/enums';
import { AppliedCustomerCreditDto } from './confirm-document.dto';

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

  // Solo se envía en devoluciones en venta (DVV); la obligatoriedad la impone
  // la estrategia, igual que adjustmentReason en EAI.
  @IsOptional()
  @IsEnum(DvvRefundMethod)
  refundMethod?: DvvRefundMethod;

  // Solo en COT: saldos a favor que la venta va a aplicar. No se persiste — solo
  // lo lee CotEffectStrategy.validateCreate para netear antes del chequeo de cupo.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppliedCustomerCreditDto)
  customerCredits?: AppliedCustomerCreditDto[];

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentItemDto)
  items!: CreateDocumentItemDto[];
}

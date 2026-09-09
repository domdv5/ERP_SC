import { IsEnum, IsOptional } from 'class-validator';
import { DocumentType, PaymentMethod } from '@/common/enums';

export class ConvertDocumentDto {
  // El service valida que sea un tipo soportado (hoy venta de contado o a
  // crédito); el DTO lo deja abierto para futuros tipos.
  @IsEnum(DocumentType)
  targetType!: DocumentType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

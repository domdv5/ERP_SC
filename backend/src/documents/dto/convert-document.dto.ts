import { IsEnum, IsOptional } from 'class-validator';
import { DocumentType, PaymentMethod } from '@/common/enums';

export class ConvertDocumentDto {
  // El service valida que sea un valor soportado (hoy solo POS) — el DTO deja
  // el campo abierto a DocumentType pensando en COT como próxima extensión.
  @IsEnum(DocumentType)
  targetType!: DocumentType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

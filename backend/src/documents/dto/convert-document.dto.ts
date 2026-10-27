import { IsEnum } from 'class-validator';
import { DocumentType } from '@/common/enums';

export class ConvertDocumentDto {
  // El service valida que sea un tipo soportado (hoy venta de contado o a
  // crédito); el DTO lo deja abierto para futuros tipos.
  @IsEnum(DocumentType)
  targetType!: DocumentType;
}

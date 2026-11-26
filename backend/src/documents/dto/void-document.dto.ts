import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentVoidReason } from '@prisma/client';

// Opcional: ventas, traslados y preventas se anulan sin body; el service exige el motivo según el tipo.
export class VoidDocumentDto {
  @IsOptional()
  @IsEnum(DocumentVoidReason, {
    message: 'Elige un motivo de anulación válido',
  })
  reason?: DocumentVoidReason;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
  reasonOther?: string;
}

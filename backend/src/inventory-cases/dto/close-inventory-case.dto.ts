import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InventoryCaseCause } from '@prisma/client';

// Mismos textos en el DTO y el service: una regla, un mensaje.
export const CLOSE_MESSAGES = {
  systemCause:
    'La causa "Ajuste anulado" solo la asigna el sistema al anular el ajuste',
  invalidCause: 'La causa no es válida',
  justificationRequired: 'La justificación es obligatoria',
  justificationTooLong: 'La justificación no puede superar los 1000 caracteres',
} as const;

// ajuste_anulado solo lo pone el sistema al anular la EAI.
export const CLOSABLE_CAUSES = Object.values(InventoryCaseCause).filter(
  (cause) => cause !== InventoryCaseCause.ajuste_anulado,
);

export class CloseInventoryCaseDto {
  @IsIn(CLOSABLE_CAUSES, {
    message: ({ value }) =>
      value === InventoryCaseCause.ajuste_anulado
        ? CLOSE_MESSAGES.systemCause
        : CLOSE_MESSAGES.invalidCause,
  })
  cause: InventoryCaseCause;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: CLOSE_MESSAGES.justificationRequired })
  @IsNotEmpty({ message: CLOSE_MESSAGES.justificationRequired })
  @MaxLength(1000, { message: CLOSE_MESSAGES.justificationTooLong })
  justification: string;

  @IsOptional()
  @IsUUID()
  originDocumentId?: string;
}

import { Transform } from 'class-transformer';
import { IsEnum, Length, ValidateIf } from 'class-validator';
import { EgresoVoidReason } from '@prisma/client';

export class VoidEgresoDto {
  @IsEnum(EgresoVoidReason, { message: 'Elige un motivo de anulación válido' })
  reason: EgresoVoidReason;

  // Solo se valida (y se guarda) con motivo "otro"; con cualquier otro se ignora.
  @ValidateIf((dto: VoidEgresoDto) => dto.reason === EgresoVoidReason.otro)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 500, {
    message: ({ value }) =>
      typeof value === 'string' && value.length > 500
        ? 'El motivo no puede superar 500 caracteres'
        : 'Escribe el motivo de la anulación',
  })
  reasonOther?: string;
}

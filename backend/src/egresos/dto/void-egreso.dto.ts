import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EgresoVoidReason } from '@prisma/client';

export class VoidEgresoDto {
  @IsEnum(EgresoVoidReason, { message: 'Elige un motivo de anulación válido' })
  reason: EgresoVoidReason;

  // Solo se valida (y se guarda) con motivo "otro"; con cualquier otro se ignora.
  @ValidateIf((dto: VoidEgresoDto) => dto.reason === EgresoVoidReason.otro)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Escribe el motivo de la anulación' })
  @IsNotEmpty({ message: 'Escribe el motivo de la anulación' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
  reasonOther?: string;
}

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidEgresoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Indica el motivo de la anulación' })
  @IsNotEmpty({ message: 'Indica el motivo de la anulación' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres' })
  reason: string;
}

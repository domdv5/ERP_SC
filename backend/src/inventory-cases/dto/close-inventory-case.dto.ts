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

// ajuste_anulado solo lo pone el sistema al anular la EAI.
export const CLOSABLE_CAUSES = Object.values(InventoryCaseCause).filter(
  (cause) => cause !== InventoryCaseCause.ajuste_anulado,
);

export class CloseInventoryCaseDto {
  @IsIn(CLOSABLE_CAUSES)
  cause: InventoryCaseCause;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'La justificación es obligatoria' })
  @MaxLength(1000)
  justification: string;

  @IsOptional()
  @IsUUID()
  originDocumentId?: string;
}

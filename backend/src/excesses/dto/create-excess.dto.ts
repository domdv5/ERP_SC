import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Matches,
  Max,
} from 'class-validator';
import type { CreateExcessBody, ExcessPartyType } from '@/contracts';

export class CreateExcessDto implements CreateExcessBody {
  @IsIn(['customer', 'supplier'])
  partyType!: ExcessPartyType;

  @IsUUID()
  thirdPartyId!: string;

  // Omitida = excedente de las CxC sin sucursal (solo clientes)
  @IsOptional()
  @IsUUID()
  customerBranchId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  // Tope de Decimal(16,2) en BD
  @Max(99999999999999.99, {
    message: 'El valor del excedente es demasiado grande',
  })
  amount!: number;

  // Sin default acá: el service lo resuelve a hoy en Bogotá
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  date?: string;

  // La genera el frontend al abrir el panel; un reintento con la misma clave no duplica (ver ExcessesService.create)
  @IsUUID()
  idempotencyKey!: string;
}

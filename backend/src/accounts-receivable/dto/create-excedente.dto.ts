import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateExcedenteDto {
  // Omitida = excedente de las CxC sin sucursal.
  @IsOptional()
  @IsUUID()
  customerBranchId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  // Sin default acá: el service lo resuelve a hoy en Bogotá.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  date?: string;
}

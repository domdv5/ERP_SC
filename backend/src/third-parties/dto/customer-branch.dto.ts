import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CustomerBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  // Código DANE del municipio; '' o null deja la sucursal sin ciudad
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'La ciudad no es válida' })
  cityCode?: string | null;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

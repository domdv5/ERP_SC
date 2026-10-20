import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CustomerBranchDto } from './customer-branch.dto';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class UpdateCustomerBranchDto extends PartialType(
  OmitType(CustomerBranchDto, ['address', 'phone'] as const),
) {
  // '' limpia el campo guardado (null); omitido = sin cambio
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
}

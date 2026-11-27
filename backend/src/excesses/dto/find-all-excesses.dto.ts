import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ExcessPartyType } from '@/contracts';

export class FindAllExcessesDto {
  @IsIn(['customer', 'supplier'])
  partyType!: ExcessPartyType;

  // Busca por consecutivo, nombre o documento del tercero
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['available', 'used', 'voided'])
  status?: 'available' | 'used' | 'voided';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

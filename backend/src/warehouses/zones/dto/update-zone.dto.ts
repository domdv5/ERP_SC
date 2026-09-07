import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateZoneDto } from './create-zone.dto';

export class UpdateZoneDto extends PartialType(CreateZoneDto) {
  // Estado local por bodega (soft-delete de la zona en ESA bodega): nunca se replica a las gemelas.
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

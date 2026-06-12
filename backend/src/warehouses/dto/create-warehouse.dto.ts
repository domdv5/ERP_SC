import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { WarehouseType } from '@prisma/client';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(WarehouseType)
  type!: WarehouseType;
}

import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { UnitOfMeasure } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  legacyCode?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID('4')
  @IsNotEmpty()
  brandId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  genderId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  categoryId!: string;

  @IsPositive()
  @IsInt()
  @IsNotEmpty()
  salePrice!: number;

  @IsPositive()
  @IsInt()
  @IsNotEmpty()
  minSalePrice!: number;

  @IsOptional()
  @IsEnum(UnitOfMeasure)
  unitOfMeasure?: UnitOfMeasure;
}

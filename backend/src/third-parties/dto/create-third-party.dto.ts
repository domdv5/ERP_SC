import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateThirdPartyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['natural', 'juridica'])
  personType!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['CC', 'NIT', 'CE', 'PAS', 'TI', 'RC'])
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isSeller?: boolean;

  @IsOptional()
  @IsBoolean()
  isCustomer?: boolean;

  @IsOptional()
  @IsBoolean()
  isSupplier?: boolean;

  // Customer-specific
  @ValidateIf((o) => o.isCustomer === true)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  creditLimit?: number;

  @ValidateIf((o) => o.isCustomer === true)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discount?: number;

  @ValidateIf((o) => o.isCustomer === true)
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  // Supplier-specific
  @ValidateIf((o) => o.isSupplier === true)
  @IsNotEmpty()
  @IsInt()
  internalNumber!: number;

  @ValidateIf((o) => o.isSupplier === true)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  brands!: string[];
}

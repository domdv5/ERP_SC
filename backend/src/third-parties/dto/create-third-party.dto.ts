import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaxRegime, WithholdingAgentType } from '@/common/enums';

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

  // Perfil tributario — informativo, sin validación de negocio (fase de
  // facturación electrónica, no iniciada, es la que consumirá estos datos).
  @IsOptional()
  @IsBoolean()
  ivaResponsible?: boolean;

  @IsOptional()
  @IsEnum(WithholdingAgentType)
  withholdingAgentType?: WithholdingAgentType;

  @IsOptional()
  @IsEnum(TaxRegime)
  taxRegime?: TaxRegime;

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
  @Min(0)
  creditLimit?: number;

  @ValidateIf((o) => o.isCustomer === true)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount?: number;

  @ValidateIf((o) => o.isCustomer === true)
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  // Supplier-specific
  @ValidateIf((o) => o.isSupplier === true)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  internalNumber!: number;

  @ValidateIf((o) => o.isSupplier === true)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  brands!: string[];
}

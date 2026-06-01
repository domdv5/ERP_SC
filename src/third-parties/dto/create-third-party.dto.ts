import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

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
}

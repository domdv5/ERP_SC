import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RegisterReceivablePaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

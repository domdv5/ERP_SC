import { IsInt, IsPositive } from 'class-validator';

export class CreateBinDto {
  @IsInt()
  @IsPositive()
  code!: string;
}

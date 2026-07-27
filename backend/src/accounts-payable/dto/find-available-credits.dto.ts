import { IsUUID } from 'class-validator';

export class FindAvailableCreditsDto {
  @IsUUID()
  supplierId!: string;
}

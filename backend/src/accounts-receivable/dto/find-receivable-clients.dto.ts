import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FindReceivableClientsDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['with_balance', 'settled'])
  status?: 'with_balance' | 'settled';

  @IsOptional()
  @IsIn(['recent', 'oldest_debt'])
  sort?: 'recent' | 'oldest_debt';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateFrom debe tener formato YYYY-MM-DD',
  })
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateTo debe tener formato YYYY-MM-DD',
  })
  dateTo?: string;
}

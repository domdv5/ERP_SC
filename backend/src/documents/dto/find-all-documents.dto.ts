import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentStatus, DocumentType } from '@/common/enums';

export class FindAllDocumentsDto {
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
  @IsEnum(DocumentType)
  type?: DocumentType;

  // Lista de DocumentType separados por coma (ej. "CM,DVC"); se mantiene como
  // string simple porque llega por query param, y el service la parsea con
  // split(','). Filtro multi-tipo; `type` arriba sigue siendo el filtro de un solo tipo.
  @IsOptional()
  @IsString()
  types?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

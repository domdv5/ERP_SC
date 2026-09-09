import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

  // Lista de tipos separados por coma (ej. "CM,DVC"). Llega como texto por la URL
  // y el service la parte por comas. Es el filtro de varios tipos; el campo `type`
  // de arriba filtra por uno solo.
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

  @IsOptional()
  @IsUUID()
  thirdPartyId?: string;
}

import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReleaseItemDto {
  @IsUUID()
  documentItemId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class ReleaseItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReleaseItemDto)
  items!: ReleaseItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

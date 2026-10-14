import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateDocumentDto } from './create-document.dto';

export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['type', 'idempotencyKey'] as const),
) {}

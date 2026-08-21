import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildPurchaseDocumentDefinition } from './purchase-document.layout';

@Injectable()
export class CmPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.CM;
  readonly documentLabel = 'COMPRA';

  buildDefinition(document: DocumentForPrint) {
    return buildPurchaseDocumentDefinition(document, { title: 'COMPRA' });
  }
}

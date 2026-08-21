import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildPurchaseDocumentDefinition } from './purchase-document.layout';

@Injectable()
export class DvcPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.DVC;
  readonly documentLabel = 'DEVOLUCION-COMPRA';

  buildDefinition(document: DocumentForPrint) {
    return buildPurchaseDocumentDefinition(document, {
      title: 'DEVOLUCIÓN EN COMPRA',
    });
  }
}

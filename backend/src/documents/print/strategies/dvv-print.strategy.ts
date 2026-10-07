import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class DvvPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.DVV;
  readonly documentLabel = 'DEVOLUCION-VENTA';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'DEVOLUCIÓN EN VENTA',
      showLegalLegend: false,
    });
  }
}

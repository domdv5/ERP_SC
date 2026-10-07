import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class PosPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.POS;
  readonly documentLabel = 'VENTA-CONTADO';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'VENTA CONTADO',
      showLegalLegend: true,
    });
  }
}

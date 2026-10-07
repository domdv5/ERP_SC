import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class CotPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.COT;
  readonly documentLabel = 'VENTA-CREDITO';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'VENTA CRÉDITO',
      showLegalLegend: true,
    });
  }
}

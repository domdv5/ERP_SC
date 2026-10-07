import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class PosoPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.POSO;
  readonly documentLabel = 'VENTA-OFICIAL';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'VENTA OFICIAL',
      showLegalLegend: true,
    });
  }
}

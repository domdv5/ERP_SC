import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents-query.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class PosoPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.POSO;
  readonly documentLabel = 'FACTURA-VENTA';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'VENTA CONTADO',
      showLegalLegend: true,
    });
  }
}

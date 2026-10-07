import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { buildSaleDocumentDefinition } from './sale-document.layout';

@Injectable()
export class PvPrintStrategy implements DocumentPrintStrategy {
  readonly type = DocumentType.PV;
  readonly documentLabel = 'PREVENTA';

  buildDefinition(document: DocumentForPrint) {
    return buildSaleDocumentDefinition(document, {
      title: 'PREVENTA',
      showLegalLegend: false,
    });
  }
}

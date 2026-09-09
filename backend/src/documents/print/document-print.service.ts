import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DocumentsService } from '@/documents/documents.service';
import { DocumentPrintRegistry } from './strategies/document-print.registry';
import { PdfGeneratorService } from './pdf-generator.service';

/**
 * Orquesta la impresión: datos → diseño → PDF. Es solo el pegamento entre las
 * tres piezas; no conoce la base de datos ni la librería de PDF.
 */
@Injectable()
export class DocumentPrintService {
  private readonly logger = new Logger(DocumentPrintService.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly printRegistry: DocumentPrintRegistry,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  async print(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const document = await this.documentsService.getDocumentForPrint(id);
    const strategy = this.printRegistry.get(document.type);

    let buffer: Buffer;
    try {
      buffer = await this.pdfGenerator.generate(strategy.buildDefinition(document));
    } catch (err) {
      // El detalle del error de la librería de PDF nunca debe llegar al cliente:
      // solo se registra internamente y la respuesta HTTP lleva un mensaje genérico.
      this.logger.error(`Error generando PDF del documento ${id}`, err as Error);
      throw new InternalServerErrorException(
        'No se pudo generar el PDF del documento',
      );
    }

    return { buffer, filename: `${strategy.documentLabel}-${document.number}.pdf` };
  }
}

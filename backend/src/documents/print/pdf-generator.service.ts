import path from 'path';
import { Injectable } from '@nestjs/common';
// Import default, no `import * as`: un namespace import envolvería pdfMake.setFonts en un getter sin setter y rompería el `this` del singleton CJS.
import pdfMake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PDF_FONTS } from './pdf-fonts.config';

// pdfmake >=0.3 exige setLocalAccessPolicy incluso para sus propias fuentes; solo se permite leer esta carpeta.
const FONTS_DIR = path.join(__dirname, 'fonts');

/** Wrapper puro de pdfmake (TDocumentDefinitions → Buffer), sin conocimiento de dominio.
 * pdfmake >=0.3 usa un módulo singleton (setFonts + createPdf().getBuffer()), no la clase PdfPrinter de versiones viejas. */
@Injectable()
export class PdfGeneratorService {
  constructor() {
    pdfMake.setFonts(PDF_FONTS);
    // Logo siempre SVG inline, nunca URL: se niega todo acceso remoto y local se limita a la carpeta de fuentes.
    pdfMake.setLocalAccessPolicy((filePath) => filePath.startsWith(FONTS_DIR));
    pdfMake.setUrlAccessPolicy(() => false);
  }

  generate(definition: TDocumentDefinitions): Promise<Buffer> {
    return pdfMake.createPdf(definition).getBuffer();
  }
}

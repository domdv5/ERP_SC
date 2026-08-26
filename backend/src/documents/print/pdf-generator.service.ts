import path from 'path';
import { Injectable } from '@nestjs/common';
// Import default (no `import * as`): un namespace import envuelve cada
// propiedad en un getter sin setter — pdfMake.setFonts(...) fallaría porque
// `this` quedaría atado a ese wrapper, no al singleton CJS real.
import pdfMake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PDF_FONTS } from './pdf-fonts.config';

// pdfmake >=0.3 pasa hasta la carga de fuentes por setLocalAccessPolicy —
// negar todo el acceso local rompía hasta los .ttf propios. Solo se permite
// leer dentro de esta carpeta de fuentes.
const FONTS_DIR = path.join(__dirname, 'fonts');

/**
 * Wrapper puro de pdfmake (TDocumentDefinitions → Buffer). Sin conocimiento de
 * dominio: nunca debe importar nada de documents.service.ts ni de las
 * strategies de impresión.
 *
 * pdfmake >=0.3 reemplazó la clase PdfPrinter (instancia por request) por un
 * módulo singleton: setFonts() registra las fuentes una sola vez y
 * createPdf()/getBuffer() ya devuelven Promise<Buffer> directo.
 */
@Injectable()
export class PdfGeneratorService {
  constructor() {
    pdfMake.setFonts(PDF_FONTS);
    // El logo se embebe como SVG inline, nunca por URL — se niega todo acceso
    // remoto. Local solo permite la carpeta de fuentes registrada arriba, para
    // que una futura definición maliciosa no pueda leer archivos del servidor.
    pdfMake.setLocalAccessPolicy((filePath) => filePath.startsWith(FONTS_DIR));
    pdfMake.setUrlAccessPolicy(() => false);
  }

  generate(definition: TDocumentDefinitions): Promise<Buffer> {
    return pdfMake.createPdf(definition).getBuffer();
  }
}

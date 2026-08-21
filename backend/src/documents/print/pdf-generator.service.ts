import path from 'path';
import { Injectable } from '@nestjs/common';
// Import default (no `import * as`): pdfmake exporta un singleton CJS y un
// namespace import via esbuild/tsx envuelve cada propiedad en un getter sin
// setter — llamadas como pdfMake.setFonts(...) fallan porque `this` queda
// atado a ese wrapper de solo lectura en vez de al objeto real.
import pdfMake from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PDF_FONTS } from './pdf-fonts.config';

// pdfmake >=0.3 pasa hasta la carga de fuentes por setLocalAccessPolicy (no
// solo imágenes referenciadas por path en el docDefinition) — negar todo el
// acceso local rompía incluso los .ttf que nosotros mismos registramos. Solo
// se permite leer dentro de esta misma carpeta de fuentes.
const FONTS_DIR = path.join(__dirname, 'fonts');

/**
 * Wrapper puro de pdfmake (TDocumentDefinitions → Buffer). Sin conocimiento
 * de dominio: nunca debe importar nada de documents.service.ts ni de las
 * strategies de impresión.
 *
 * pdfmake >=0.3 reemplazó la clase PdfPrinter (una instancia por request,
 * con createPdfKitDocument()) por un módulo singleton: las fuentes se
 * registran una sola vez con setFonts() y createPdf()/getBuffer() ya
 * devuelven una Promise<Buffer> sin necesidad de juntar chunks del stream
 * manualmente.
 */
@Injectable()
export class PdfGeneratorService {
  constructor() {
    pdfMake.setFonts(PDF_FONTS);
    // Los documentos generados acá nunca referencian imágenes por URL (el
    // logo se embebe como SVG inline) — se niega por completo. Local sí debe
    // permitir la carpeta de fuentes registrada arriba; todo lo demás queda
    // negado para que una futura definición maliciosa no pueda leer archivos
    // arbitrarios del servidor.
    pdfMake.setLocalAccessPolicy((filePath) => filePath.startsWith(FONTS_DIR));
    pdfMake.setUrlAccessPolicy(() => false);
  }

  generate(definition: TDocumentDefinitions): Promise<Buffer> {
    return pdfMake.createPdf(definition).getBuffer();
  }
}

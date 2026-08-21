import path from 'path';
import type { TFontDictionary } from 'pdfmake/interfaces';

// Los .ttf de Roboto se copiaron literalmente desde
// node_modules/pdfmake/build/fonts/Roboto/ (pdfmake >=0.3 los distribuye como
// archivos reales, ya no como vfs_fonts.js en base64) — no descargados de una
// fuente externa. path.join(__dirname, ...) en vez de rutas relativas frágiles
// porque esto debe resolver igual desde dist/documents/print/ compilado.
export const PDF_FONTS: TFontDictionary = {
  Roboto: {
    normal: path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'fonts', 'Roboto-Medium.ttf'),
    italics: path.join(__dirname, 'fonts', 'Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'fonts', 'Roboto-MediumItalic.ttf'),
  },
};

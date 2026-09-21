import path from 'path';
import type { TFontDictionary } from 'pdfmake/interfaces';

// .ttf copiados de node_modules/pdfmake/build/fonts/Roboto/ (pdfmake >=0.3 los distribuye como archivos reales, no base64).
// __dirname en vez de ruta relativa: debe resolver igual desde dist/ compilado.
export const PDF_FONTS: TFontDictionary = {
  Roboto: {
    normal: path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'),
    bold: path.join(__dirname, 'fonts', 'Roboto-Medium.ttf'),
    italics: path.join(__dirname, 'fonts', 'Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, 'fonts', 'Roboto-MediumItalic.ttf'),
  },
};

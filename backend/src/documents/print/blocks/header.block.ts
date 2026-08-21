import type { Content, DynamicContent } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';
import { COMPANY_INFO } from '../company-info.constant';

// document.date se guarda como medianoche UTC representando el día calendario
// elegido (documents.service.ts hace `new Date(dateString)` sobre un string
// sin hora) — formatear en UTC preserva ese día exacto sin importar el huso
// horario del servidor; usar America/Bogota acá lo correría un día atrás.
function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

/**
 * pdfmake reevalúa header/footer en cada página, por eso ambos se devuelven
 * como función en vez de un Content estático — necesario si el documento
 * termina paginando por tener muchas líneas.
 *
 * Del formato legado se omiten deliberadamente "Ciudad" y "Vence" del bloque
 * del tercero: ThirdParty no tiene campo de ciudad y el dominio no modela
 * plazo de crédito (decisión ya confirmada con el usuario).
 */
export function buildHeader(
  document: DocumentForPrint,
  title: string,
): DynamicContent {
  return (): Content => {
    const thirdParty = document.thirdParty;

    return {
      margin: [30, 20, 30, 10],
      columns: [
        {
          width: '55%',
          columns: [
            { svg: COMPANY_INFO.logoSvg, width: 42 },
            {
              width: '*',
              margin: [8, 0, 0, 0],
              stack: [
                { text: COMPANY_INFO.name, bold: true, fontSize: 10 },
                { text: `Nit: ${COMPANY_INFO.nit}`, fontSize: 8 },
                { text: COMPANY_INFO.address, fontSize: 8 },
                { text: COMPANY_INFO.city, fontSize: 8 },
                { text: `Tel: ${COMPANY_INFO.phone}`, fontSize: 8 },
              ],
            },
          ],
        },
        {
          width: '45%',
          stack: [
            { text: title, bold: true, fontSize: 13, alignment: 'right' },
            {
              text: `Fecha: ${formatDate(document.date)}`,
              fontSize: 8,
              alignment: 'right',
              margin: [0, 4, 0, 6],
            },
            {
              text: thirdParty?.name ?? '',
              bold: true,
              fontSize: 9,
              alignment: 'right',
            },
            {
              text: thirdParty
                ? `Nit: ${thirdParty.documentType} ${thirdParty.documentNumber}`
                : '',
              fontSize: 8,
              alignment: 'right',
            },
            { text: thirdParty?.address ?? '', fontSize: 8, alignment: 'right' },
            { text: thirdParty?.phone ?? '', fontSize: 8, alignment: 'right' },
          ],
        },
      ],
    };
  };
}

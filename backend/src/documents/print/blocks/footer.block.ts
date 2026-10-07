import type { Content, DynamicContent } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';

// createdAt es timestamp real (no fecha-calendario): se formatea en la zona horaria del negocio, no UTC.
function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(date));
}

export const SALE_LEGAL_LEGEND =
  'ESTE ES UN DOCUMENTO PRELIMINAR, AUN NO CUENTA CON EL PROCESO DE VALIDACIÓN EN LA DIAN, LA FACTURA ELECTRONICA LLEGARÁ A SU CORREO UNA VEZ SE SURTA DICHO PROCESO. PASADOS 8 DÍAS NO SE ACEPTAN DEVOLUCIONES,CAMBIOS, NI RECLAMOS. LA ROPA INTERIOR NO TIENE CAMBIOS.';

// Formato d/M/yyyy h:mm:ss AM/PM en zona del negocio; por partes porque ICU puede insertar espacios especiales.
function formatDateTime(date: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota',
  }).formatToParts(new Date(date));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod').toUpperCase()}`;
}

/** Pie de ventas: leyenda legal (opcional) + "Creó" (reemplaza "Elaborado por") + paginación. */
export function buildSaleFooter(
  document: DocumentForPrint,
  showLegalLegend: boolean,
): DynamicContent {
  return (currentPage: number, pageCount: number): Content => ({
    margin: [30, 0, 30, 10],
    stack: [
      ...(showLegalLegend
        ? [{ text: SALE_LEGAL_LEGEND, fontSize: 6.5, color: '#444444' }]
        : []),
      {
        margin: [0, showLegalLegend ? 3 : 0, 0, 0],
        columns: [
          {
            width: '*',
            text: `Creó: ${document.user.name} -- ${formatDateTime(document.createdAt)}`,
            fontSize: 7,
            color: '#666666',
          },
          {
            width: 'auto',
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 7,
            color: '#666666',
            alignment: 'right',
          },
        ],
      },
    ],
  });
}

export function buildFooter(document: DocumentForPrint): DynamicContent {
  return (currentPage: number, pageCount: number): Content => ({
    margin: [30, 0, 30, 20],
    columns: [
      {
        width: '*',
        text: `Elaborado por: ${document.user.name} — ${formatDate(document.createdAt)}`,
        fontSize: 7,
        color: '#666666',
      },
      {
        width: 'auto',
        text: `Página ${currentPage} de ${pageCount}`,
        fontSize: 7,
        color: '#666666',
        alignment: 'right',
      },
    ],
  });
}

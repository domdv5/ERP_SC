import type { Content, DynamicContent } from 'pdfmake/interfaces';
import type { DocumentForPrint } from '@/documents/documents.service';

// createdAt es un timestamp real (no una fecha-calendario como
// document.date) — se formatea en la zona horaria real del negocio en vez
// de UTC, para no depender del huso horario del servidor.
function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(date));
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

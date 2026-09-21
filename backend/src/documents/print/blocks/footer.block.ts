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

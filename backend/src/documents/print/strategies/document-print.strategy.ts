import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';

/** Contrato de impresión por tipo (patrón Strategy): un tipo nuevo solo agrega una clase, sin tocar el service de impresión. */
export interface DocumentPrintStrategy {
  /** Tipo de documento que maneja esta estrategia. */
  readonly type: DocumentType;

  /** Prefijo del nombre de archivo del PDF, ej. "COMPRA" -> COMPRA-000123.pdf */
  readonly documentLabel: string;

  /** Arma la definición completa del PDF a partir del documento ya cargado. */
  buildDefinition(document: DocumentForPrint): TDocumentDefinitions;
}

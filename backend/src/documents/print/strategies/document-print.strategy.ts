import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { DocumentType } from '@/common/enums';
import type { DocumentForPrint } from '@/documents/documents.service';

/**
 * Contrato de impresión por tipo de documento (patrón Strategy, paralelo a
 * DocumentEffectStrategy). Cada tipo soportado registra su estrategia en
 * DocumentPrintRegistry; agregar un tipo de fase 2 (COT, POS, ...) solo
 * requiere una clase nueva, sin tocar DocumentPrintService.
 */
export interface DocumentPrintStrategy {
  /** Tipo de documento que maneja esta estrategia. */
  readonly type: DocumentType;

  /** Prefijo del nombre de archivo del PDF, ej. "COMPRA" -> COMPRA-000123.pdf */
  readonly documentLabel: string;

  /** Arma la definición pdfmake completa a partir del documento ya cargado. */
  buildDefinition(document: DocumentForPrint): TDocumentDefinitions;
}

import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';

/** Documento con los includes que el service carga antes de confirmar. */
export type DocumentWithItems = Prisma.DocumentGetPayload<{
  include: {
    documentItems: { include: { product: true } };
    thirdParty: { include: { supplier: true } };
  };
}>;

/** Contrato de efectos por tipo de documento (patrón Strategy): un tipo nuevo solo agrega una clase registrada, sin tocar el service. */
export interface DocumentEffectStrategy {
  /** Tipo de documento que maneja esta estrategia. */
  readonly type: DocumentType;

  /**
   * Validaciones específicas del tipo al crear el borrador
   * (proveedor requerido, bodegas distintas, etc.).
   */
  validateCreate?(createDocumentDto: CreateDocumentDto): Promise<void> | void;

  /**
   * Efectos al confirmar: movimientos kardex, inventario, cuentas.
   * Corre dentro del $transaction del service.
   */
  confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ): Promise<void>;
}

/** Contrato aparte para los tipos con reserva lógica de stock (preventas y remisiones): evita obligar a implementar la liberación en tipos que no reservan (compras, traslados...). */
export interface ReservationEffectStrategy extends DocumentEffectStrategy {
  /**
   * Libera (parcial o totalmente) la reserva pendiente de una o más líneas
   * del documento. Corre dentro del $transaction que abre el service.
   */
  releaseItems(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    releases: { documentItemId: string; quantity: number }[],
    userId: string,
    notes?: string,
  ): Promise<void>;

  /**
   * Descuenta de la reserva lo que la venta consumió al confirmarse, cuando esa
   * venta nació de convertir este documento.
   */
  consumeForConversion(
    tx: Prisma.TransactionClient,
    sourceDocument: DocumentWithItems,
    conversions: { documentItemId: string; quantity: number }[],
    userId: string,
  ): Promise<void>;
}

/** Comprueba en tiempo de ejecución si una estrategia sabe liberar reservas. */
export function isReservationStrategy(
  strategy: DocumentEffectStrategy,
): strategy is ReservationEffectStrategy {
  return (
    typeof (strategy as ReservationEffectStrategy).releaseItems === 'function'
  );
}

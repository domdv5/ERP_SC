import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';

/** Documento con los includes que el service carga antes de confirmar. */
export type DocumentWithItems = Prisma.DocumentGetPayload<{
  include: {
    documentItems: { include: { product: true } };
    payments: true;
    thirdParty: { include: { supplier: true; customer: true } };
  };
}>;

/** Includes que carga DocumentVoidService; compartidos para tipar el documento que recibe undoEffects. */
export const DOCUMENT_TO_VOID_INCLUDE = {
  documentItems: {
    select: { id: true, productId: true, quantity: true },
  },
  derivedDocuments: { select: { id: true, status: true } },
  inventoryMovements: {
    include: { documentItem: { select: { unitCost: true } } },
  },
  accountsPayable: {
    include: {
      payablePayments: true,
      creditApplications: true,
      egresoAllocations: true,
    },
  },
  accountsReceivable: {
    include: { receivablePayments: true, reciboCajaAllocations: true },
  },
  supplierCredits: { include: { applications: true } },
  customerCredits: { include: { applications: true } },
  appliedCustomerCredits: true,
} satisfies Prisma.DocumentInclude;

/** Documento a anular, con los includes de DOCUMENT_TO_VOID_INCLUDE. */
export type DocumentToVoid = Prisma.DocumentGetPayload<{
  include: typeof DOCUMENT_TO_VOID_INCLUDE;
}>;

/** Datos extra que el service pasa a confirm() según el body del endpoint (solo lo usan POS/COT, para saldos a favor). */
export type ConfirmContext = {
  appliedCustomerCredits?: { customerCreditId: string; amount: number }[];
};

export type MissingStockItem = {
  productId: string;
  code: string;
  available: number;
  requested: number;
};

/** Contrato de efectos por tipo de documento (patrón Strategy): un tipo nuevo solo agrega una clase registrada, sin tocar el service. */
export interface DocumentEffectStrategy {
  /** Tipo de documento que maneja esta estrategia. */
  readonly type: DocumentType;

  /** Si el documento guarda la sucursal del cliente (solo ventas). */
  readonly tracksCustomerBranch: boolean;

  /** Si el documento siempre lleva la fecha de hoy (Bogotá), sin aceptar la del pedido. */
  readonly usesTodayDate: boolean;

  /** Si el documento guarda quién recibe la mercancía (solo compras). */
  readonly tracksReceiver: boolean;

  /** Validaciones específicas del tipo al crear el borrador. */
  validateCreate?(createDocumentDto: CreateDocumentDto): Promise<void> | void;

  /** Efectos al confirmar (kardex, inventario, cuentas), dentro del $transaction del service. */
  confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
    context?: ConfirmContext,
  ): Promise<void>;

  /** Efectos propios del tipo al anular, tras reclamar el estado y antes de revertir el stock; lo común lo hace el service. */
  undoEffects?(
    tx: Prisma.TransactionClient,
    document: DocumentToVoid,
    userId: string,
  ): Promise<void>;

  /** Hora en que se agregó un ítem al documento: la del carrito si el tipo la registra, si no la del servidor. */
  resolveItemAddedAt(requested: string | undefined, now: Date): Date;

  /** Faltantes de stock con la misma regla que confirm; solo los tipos que validan disponible al confirmar. */
  findMissingStock?(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
  ): Promise<MissingStockItem[]>;
}

/** Contrato aparte para los tipos con reserva lógica de stock (preventas y remisiones): evita obligar a implementar la liberación en tipos que no reservan (compras, traslados...). */
export interface ReservationEffectStrategy extends DocumentEffectStrategy {
  /** Libera (parcial o totalmente) la reserva pendiente de una o más líneas del documento. */
  releaseItems(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    releases: { documentItemId: string; quantity: number }[],
    userId: string,
    notes?: string,
  ): Promise<void>;

  /** Descuenta de la reserva lo que consumió la venta nacida de convertir este documento. */
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

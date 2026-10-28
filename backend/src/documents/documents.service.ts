import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { todayInBogota } from '@/common/utils/date-range.util';
import {
  ConfirmDocumentDto,
  CreateDocumentDto,
  ReleaseItemsDto,
  UpdateDocumentDto,
} from './dto/index';
import { matchItemsByProduct } from './helpers/conversion.helpers';
import {
  DUPLICATE_REQUEST_MESSAGE,
  isIdempotencyKeyConflict,
  isSameDocumentRequest,
} from './helpers/idempotency.helpers';
import {
  assertOfficialFieldsAllowed,
  computeAmounts,
} from './helpers/document-amounts';
import {
  assertDocumentPermission,
  lockDocumentStatus,
} from './helpers/document-guards.helpers';
import { withPvStatus } from './helpers/pv-status.helper';
import {
  DETAIL_INCLUDE,
  DocumentsQueryService,
} from './documents-query.service';
import { resolveDocumentDate } from './helpers/document-date.helper';
import {
  DocumentEffectsRegistry,
  isReservationStrategy,
} from './strategies/index';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
    private readonly sequenceService: SequenceService,
    private readonly documentsQuery: DocumentsQueryService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto, user: JwtPayload) {
    const {
      type,
      date,
      items,
      thirdPartyId,
      sellerId,
      receiverId,
      customerBranchId,
      destWarehouseId,
      destBinId,
      sourceBinId,
      notes,
      adjustmentReason,
      adjustmentReasonOther,
      payments,
      refundMethod,
      officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId,
      idempotencyKey,
      ...rest
    } = createDocumentDto;

    assertDocumentPermission(user, type);
    assertOfficialFieldsAllowed(type, {
      officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId,
    });

    if (idempotencyKey) {
      const alreadyCreated = await this.findByIdempotencyKey(
        idempotencyKey,
        createDocumentDto,
        user,
      );
      if (alreadyCreated) return alreadyCreated;
    }

    // Falla si el tipo de documento todavía no está implementado.
    const strategy = this.effectsRegistry.get(type);
    const now = new Date();

    await strategy.validateCreate?.(createDocumentDto);

    let warehouseId: string | undefined;

    // Solo el traslado mueve stock entre bodegas que elige el usuario; el resto
    // siempre opera sobre la tienda activa, y la bodega no se recibe desde afuera.
    if (type !== DocumentType.T) {
      const store = await this.prisma.warehouse.findFirst({
        where: { type: 'store', active: true },
      });
      if (!store) {
        throw new BadRequestException(
          'No existe una tienda activa para asignar al documento',
        );
      }
      warehouseId = store.id;
    } else {
      warehouseId = rest.warehouseId;
    }

    const createInTransaction = () =>
      this.prisma.$transaction(async (tx) => {
        const number = await this.nextNumber(tx, type);
        const amounts = computeAmounts(items, type);

        return tx.document.create({
          data: {
            type,
            number,
            date: resolveDocumentDate(strategy.usesTodayDate, date),
            thirdPartyId,
            sellerId,
            receiverId: strategy.tracksReceiver ? receiverId : undefined,
            customerBranchId: strategy.tracksCustomerBranch
              ? (customerBranchId ?? null)
              : null,
            userId: user.sub,
            status: DocumentStatus.draft,
            total: amounts.total,
            taxTotal: amounts.taxTotal,
            notes,
            warehouseId,
            destWarehouseId,
            destBinId,
            sourceBinId,
            adjustmentReason,
            adjustmentReasonOther,
            refundMethod: refundMethod ?? null,
            officialPurchase: officialPurchase ?? false,
            supplierInvoiceNumber: supplierInvoiceNumber?.trim() || null,
            sourceDocumentId: sourceDocumentId ?? null,
            idempotencyKey: idempotencyKey ?? null,
            ...(payments && {
              payments: { create: payments },
            }),
            documentItems: {
              create: items.map((item, index) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost ?? 0,
                unitPrice: item.unitPrice ?? 0,
                subtotal: amounts.lines[index].subtotal,
                taxAmount: amounts.lines[index].taxAmount,
                observaciones: item.observaciones ?? null,
                addedAt: strategy.resolveItemAddedAt(item.addedAt, now),
              })),
            },
          },
          include: DETAIL_INCLUDE,
        });
      });

    let document: Awaited<ReturnType<typeof createInTransaction>>;
    try {
      document = await createInTransaction();
    } catch (error) {
      // Carrera real entre dos pedidos con la misma clave: el @unique revienta con P2002 después de que ambos pasaron la búsqueda.
      if (idempotencyKey && isIdempotencyKeyConflict(error)) {
        const winner = await this.findByIdempotencyKey(
          idempotencyKey,
          createDocumentDto,
          user,
        );
        if (winner) return winner;
      }
      throw error;
    }

    return withPvStatus(document);
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
    dto: CreateDocumentDto,
    user: JwtPayload,
  ) {
    const existing = await this.prisma.document.findUnique({
      where: { idempotencyKey },
      include: DETAIL_INCLUDE,
    });
    if (!existing) return null;
    const strategy = this.effectsRegistry.get(dto.type);
    if (!isSameDocumentRequest(dto, existing, user.sub, strategy)) {
      throw new ConflictException(DUPLICATE_REQUEST_MESSAGE);
    }
    return withPvStatus(existing);
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden editar documentos en borrador',
      );
    }

    // customerCredits no es columna de Document (solo lo usa la venta a crédito
    // para netear el cupo al validar); se descarta antes de tocar la fila.
    const {
      items,
      date,
      customerCredits: _customerCredits,
      payments,
      supplierInvoiceNumber,
      receiverId,
      customerBranchId,
      ...rest
    } = updateDocumentDto;

    assertOfficialFieldsAllowed(document.type, {
      officialPurchase: rest.officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId: rest.sourceDocumentId,
    });
    const amounts = items && computeAmounts(items, document.type);
    const strategy = this.effectsRegistry.get(document.type);
    const newDate = resolveDocumentDate(strategy.usesTodayDate, date);
    const now = new Date();

    // Al editar un borrador no se vuelven a correr las validaciones de creación.
    // Por eso la confirmación del traslado revalida bulto y bodega desde cero.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (items && amounts) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        await tx.documentItem.createMany({
          data: items.map((item, index) => ({
            documentId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            unitPrice: item.unitPrice ?? 0,
            subtotal: amounts.lines[index].subtotal,
            taxAmount: amounts.lines[index].taxAmount,
            observaciones: item.observaciones ?? null,
            addedAt: strategy.resolveItemAddedAt(item.addedAt, now),
          })),
        });
      }

      if (payments) {
        await tx.documentPayment.deleteMany({ where: { documentId: id } });
        await tx.documentPayment.createMany({
          data: payments.map((payment) => ({ documentId: id, ...payment })),
        });
      }

      return tx.document.update({
        where: { id },
        data: {
          ...rest,
          ...(strategy.tracksReceiver &&
            receiverId !== undefined && { receiverId }),
          ...(strategy.tracksCustomerBranch &&
            customerBranchId !== undefined && { customerBranchId }),
          updatedById: user.sub,
          editedAt: now,
          ...(newDate && { date: newDate }),
          ...(supplierInvoiceNumber !== undefined && {
            supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
          }),
          ...(amounts && {
            total: amounts.total,
            taxTotal: amounts.taxTotal,
          }),
        },
        include: DETAIL_INCLUDE,
      });
    });

    return withPvStatus(updated);
  }

  /** Faltantes de stock de un borrador, con la misma regla que usa confirm(); [] si el tipo no valida stock. */
  async findMissingStock(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (
      document.status !== DocumentStatus.draft ||
      document.documentItems.length === 0 ||
      !document.warehouseId
    ) {
      return [];
    }

    const strategy = this.effectsRegistry.get(document.type);
    if (!strategy.findMissingStock) return [];

    // Sin $transaction: el FOR UPDATE se libera al instante en autocommit y una lectura nunca retiene locks de inventario.
    return strategy.findMissingStock(this.prisma, document);
  }

  async confirm(
    id: string,
    dto: ConfirmDocumentDto | undefined,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden confirmar documentos en borrador',
      );
    }

    if (document.documentItems.length === 0) {
      throw new BadRequestException(
        'El documento no tiene ítems para confirmar',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Si otro proceso ya confirmó o anuló el documento, no aplicar efectos.
        const claimed = await tx.document.updateMany({
          where: { id, status: DocumentStatus.draft },
          data: {
            status: DocumentStatus.confirmed,
            confirmedById: user.sub,
            confirmedAt: new Date(),
            ...(this.effectsRegistry.get(document.type).usesTodayDate && {
              date: todayInBogota(),
            }),
          },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden confirmar documentos en borrador',
          );
        }

        // context lleva los saldos a favor del cliente citados en el body; solo
        // los usan POS/COT, el resto de estrategias lo ignora.
        await this.effectsRegistry
          .get(document.type)
          .confirm(tx, document, user.sub, {
            appliedCustomerCredits: dto?.customerCredits,
          });

        // Si este documento nació de convertir una preventa o remisión, descuenta
        // lo vendido de la reserva original en la misma transacción (todo o nada).
        if (document.sourceDocumentId) {
          const source = await tx.document.findUnique({
            where: { id: document.sourceDocumentId },
            include: {
              documentItems: { include: { product: true } },
              payments: true,
              thirdParty: { include: { supplier: true, customer: true } },
            },
          });

          if (source) {
            const sourceStrategy = this.effectsRegistry.get(source.type);
            if (isReservationStrategy(sourceStrategy)) {
              const conversions = matchItemsByProduct(
                source.documentItems,
                document.documentItems,
              );
              await sourceStrategy.consumeForConversion(
                tx,
                source,
                conversions,
                user.sub,
              );
            }
          }
        }
      },
      { timeout: 30000 },
    );

    return this.documentsQuery.findOne(id);
  }

  async remove(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden eliminar documentos en borrador',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.documentPayment.deleteMany({ where: { documentId: id } });
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      return tx.document.delete({ where: { id } });
    });
  }

  /** Libera, total o parcialmente, la reserva pendiente de un documento confirmado (solo preventas y remisiones). */
  async releaseItems(
    id: string,
    releaseItemsDto: ReleaseItemsDto,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type, 'release');

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden liberar reservas de documentos confirmados',
      );
    }

    const strategy = this.effectsRegistry.getReservation(document.type);

    await this.prisma.$transaction(async (tx) => {
      // Re-chequeo bajo lock: una anulación concurrente no puede colarse entre el chequeo de arriba y la liberación.
      const status = await lockDocumentStatus(tx, id);
      if (status !== DocumentStatus.confirmed) {
        throw new ConflictException(
          'Solo se pueden liberar reservas de documentos confirmados',
        );
      }

      await strategy.releaseItems(
        tx,
        document,
        releaseItemsDto.items,
        user.sub,
        releaseItemsDto.notes,
      );
    });

    return this.documentsQuery.findOne(id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async nextNumber(tx: Prisma.TransactionClient, type: DocumentType) {
    // Antes calculaba MAX(number)+1 sin lock (repetía número bajo concurrencia); ahora delega en SequenceService.
    return this.sequenceService.next(tx, type);
  }
}

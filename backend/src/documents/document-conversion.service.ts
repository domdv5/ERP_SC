import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { ConvertDocumentDto, CreateDocumentDto } from './dto/index';
import { RESERVATION_TYPES } from './helpers/reservation.helpers';
import { computeItemSubtotal, computeTotal } from './helpers/document-amounts';
import {
  assertDocumentPermission,
  lockDocumentStatus,
} from './helpers/document-guards.helpers';
import { withPvStatus } from './helpers/pv-status.helper';
import { resolveDocumentDate } from './helpers/document-date.helper';
import { DETAIL_INCLUDE } from './documents-query.service';
import { DocumentEffectsRegistry } from './strategies/index';

@Injectable()
export class DocumentConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
    private readonly sequenceService: SequenceService,
  ) {}

  async duplicate(id: string, user: JwtPayload) {
    const source = await this.prisma.document.findUnique({
      where: { id },
      include: { documentItems: true },
    });

    if (!source) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, source.type);

    if (source.type !== DocumentType.CM) {
      throw new BadRequestException('Solo se pueden duplicar compras (CM)');
    }

    // Igual que al crear: revalida que los productos sigan perteneciendo a una
    // marca del proveedor (pudo cambiar desde que se creó el documento original).
    const strategy = this.effectsRegistry.get(DocumentType.CM);
    const validateCreateDto: CreateDocumentDto = {
      type: DocumentType.CM,
      date: new Date().toISOString(),
      thirdPartyId: source.thirdPartyId ?? undefined,
      items: source.documentItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };
    await strategy.validateCreate?.(validateCreateDto);

    const document = await this.prisma.$transaction(async (tx) => {
      const consecutive = await this.sequenceService.next(tx, DocumentType.CM);

      const items = source.documentItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: Number(item.unitCost),
        unitPrice: Number(item.unitPrice),
        observaciones: item.observaciones ?? undefined,
      }));

      const document = await tx.document.create({
        data: {
          type: DocumentType.CM,
          number: consecutive,
          status: DocumentStatus.draft,
          date: new Date(),
          userId: user.sub,
          // Acá no se recalcula la tienda activa: se copia la del original. Si la
          // tienda activa cambió, el duplicado apunta a la bodega vieja (aceptado por ahora).
          warehouseId: source.warehouseId,
          thirdPartyId: source.thirdPartyId,
          notes: source.notes,
          documentItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              unitPrice: item.unitPrice,
              observaciones: item.observaciones ?? null,
              subtotal: computeItemSubtotal(item, DocumentType.CM),
            })),
          },
          total: computeTotal(items, DocumentType.CM),
        },
        include: DETAIL_INCLUDE,
      });

      return document;
    });

    return withPvStatus(document);
  }

  /** Convierte una preventa o remisión confirmada en una venta real; el descuento de la reserva ocurre al confirmar la derivada, no acá. */
  async convert(sourceId: string, dto: ConvertDocumentDto, user: JwtPayload) {
    const source = await this.prisma.document.findUnique({
      where: { id: sourceId },
      include: {
        documentItems: { include: { product: true } },
        derivedDocuments: { select: { id: true, status: true } },
      },
    });

    if (!source) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (
      !RESERVATION_TYPES.includes(source.type) ||
      source.status !== DocumentStatus.confirmed
    ) {
      throw new BadRequestException(
        'Solo se pueden convertir preventas o remisiones confirmadas',
      );
    }

    // El permiso depende del tipo de origen: convertir preventas o convertir remisiones.
    assertDocumentPermission(user, source.type, 'convert');

    // Confirmar la venta derivada ya exige su propio permiso de creación; acá
    // solo se restringe a los tipos de venta que admiten conversión.
    if (
      dto.targetType !== DocumentType.POS &&
      dto.targetType !== DocumentType.COT
    ) {
      throw new BadRequestException(
        `Conversión a ${dto.targetType} no soportada`,
      );
    }

    // Solo conversión total: una segunda conversión sin este guard dejaría un borrador que nunca se puede confirmar.
    if (
      source.derivedDocuments.some((d) => d.status !== DocumentStatus.voided)
    ) {
      throw new ConflictException(
        'Este documento ya tiene una venta derivada activa. Anúlela antes de convertir de nuevo.',
      );
    }

    const pendingItems = source.documentItems
      .map((item) => ({
        item,
        pending: item.quantity - item.releasedQuantity - item.convertedQuantity,
      }))
      .filter(({ pending }) => pending > 0);

    if (pendingItems.length === 0) {
      throw new BadRequestException(
        'El documento ya fue completamente convertido o liberado',
      );
    }

    const validateCreateDto: CreateDocumentDto = {
      type: dto.targetType,
      date: new Date().toISOString(),
      thirdPartyId: source.thirdPartyId ?? undefined,
      sellerId: source.sellerId ?? undefined,
      customerBranchId: source.customerBranchId ?? undefined,
      items: pendingItems.map(({ item, pending }) => ({
        productId: item.productId,
        quantity: pending,
        unitPrice: Number(item.unitPrice),
      })),
    };

    // Revalida contra las reglas del tipo destino (p. ej. cupo de crédito); si el piso de precio subió, puede rechazarse — es lo esperado.
    const targetStrategy = this.effectsRegistry.get(dto.targetType);
    await targetStrategy.validateCreate?.(validateCreateDto);

    const store = await this.prisma.warehouse.findFirst({
      where: { type: 'store', active: true },
    });
    if (!store) {
      throw new BadRequestException(
        'No existe una tienda activa para asignar al documento',
      );
    }

    const derived = await this.prisma.$transaction(async (tx) => {
      // Bloquea el origen y re-chequea: dos conversiones simultáneas pasarían ambas el chequeo de arriba.
      const status = await lockDocumentStatus(tx, source.id);
      if (status !== DocumentStatus.confirmed) {
        throw new ConflictException(
          'Solo se pueden convertir preventas o remisiones confirmadas',
        );
      }
      const activeDerived = await tx.document.count({
        where: {
          sourceDocumentId: source.id,
          status: { not: DocumentStatus.voided },
        },
      });
      if (activeDerived > 0) {
        throw new ConflictException(
          'Este documento ya tiene una venta derivada activa. Anúlela antes de convertir de nuevo.',
        );
      }

      const number = await this.sequenceService.next(tx, dto.targetType);
      const total = computeTotal(validateCreateDto.items, dto.targetType);

      const created = await tx.document.create({
        data: {
          type: dto.targetType,
          number,
          date: resolveDocumentDate(
            this.effectsRegistry.get(dto.targetType).usesTodayDate,
            new Date().toISOString(),
          ),
          thirdPartyId: source.thirdPartyId,
          sellerId: source.sellerId,
          customerBranchId: source.customerBranchId,
          userId: user.sub,
          status: DocumentStatus.draft,
          total,
          warehouseId: store.id,
          sourceDocumentId: source.id,
          documentItems: {
            create: validateCreateDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? 0,
              subtotal: computeItemSubtotal(item, dto.targetType),
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });

      // Deja registrado en el origen quién y cuándo lo convirtió. El descuento
      // real de la reserva ocurre al confirmar la venta derivada.
      await tx.document.update({
        where: { id: source.id },
        data: { convertedById: user.sub, convertedAt: new Date() },
      });

      return created;
    });

    // La respuesta es la venta derivada, así que el bloque de conversión sale
    // vacío; se mantiene la misma forma que el resto de las lecturas.
    return withPvStatus(derived);
  }
}

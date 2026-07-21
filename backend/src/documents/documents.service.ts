import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType, MovementType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateDocumentDto,
  CreateDocumentItemDto,
  FindAllDocumentsDto,
  UpdateDocumentDto,
} from './dto/index';
import { applyBinStockChange, applyStockChange } from './helpers/stock.helpers';
import { DocumentEffectsRegistry } from './strategies/index';

const DETAIL_INCLUDE = {
  documentItems: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          description: true,
          avgCost: true,
          unitOfMeasure: true,
        },
      },
    },
  },
  thirdParty: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  destWarehouse: { select: { id: true, name: true } },
  destBin: { include: { zone: { select: { name: true } } } },
  sourceDocument: { select: { id: true, type: true, number: true } },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
  ) {}

  async findAll(findAllDocumentsDto: FindAllDocumentsDto) {
    const {
      page = 1,
      limit = 20,
      type,
      types,
      status,
      dateFrom,
      dateTo,
      search,
    } = findAllDocumentsDto;
    const skip = (page - 1) * limit;

    const typeList = types
      ? (types.split(',').filter(Boolean) as DocumentType[])
      : undefined;

    const where: Prisma.DocumentWhereInput = {
      ...(typeList?.length ? { type: { in: typeList } } : type && { type }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && { number: { contains: search } }),
    };

    const [items, total, draftCount, confirmedCount] =
      await this.prisma.$transaction([
        this.prisma.document.findMany({
          where,
          include: {
            thirdParty: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
            destWarehouse: { select: { id: true, name: true } },
            _count: { select: { documentItems: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.document.count({ where }),
        this.prisma.document.count({
          where: { ...where, status: DocumentStatus.draft },
        }),
        this.prisma.document.count({
          where: { ...where, status: DocumentStatus.confirmed },
        }),
      ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        draftCount,
        confirmedCount,
      },
    };
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return document;
  }

  async create(createDocumentDto: CreateDocumentDto, user: JwtPayload) {
    const {
      type,
      date,
      items,
      thirdPartyId,
      destWarehouseId,
      destBinId,
      sourceBinId,
      freight,
      notes,
      ...rest
    } = createDocumentDto;

    this.assertDocumentPermission(user, type);

    // Lanza BadRequestException si el tipo aún no tiene estrategia (fase 2).
    const strategy = this.effectsRegistry.get(type);

    await strategy.validateCreate?.(createDocumentDto);

    let warehouseId: string | undefined;

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

    const document = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, type);
      const total = this.computeTotal(items);

      return tx.document.create({
        data: {
          type,
          number,
          date: new Date(date),
          thirdPartyId,
          userId: user.sub,
          status: DocumentStatus.draft,
          total,
          freight,
          notes,
          warehouseId,
          destWarehouseId,
          destBinId,
          sourceBinId,
          documentItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost ?? 0,
              subtotal: item.quantity * (item.unitCost ?? 0),
              observaciones: item.observaciones ?? null,
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });
    });

    return document;
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

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden editar documentos en borrador',
      );
    }

    const { items, date, ...rest } = updateDocumentDto;

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        await tx.documentItem.createMany({
          data: items.map((item) => ({
            documentId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            subtotal: item.quantity * (item.unitCost ?? 0),
            observaciones: item.observaciones ?? null,
          })),
        });
      }

      return tx.document.update({
        where: { id },
        data: {
          ...rest,
          ...(date && { date: new Date(date) }),
          ...(items && { total: this.computeTotal(items) }),
        },
        include: DETAIL_INCLUDE,
      });
    });
  }

  async confirm(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        thirdParty: { include: { supplier: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

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
        // Bloqueo optimista: si otro proceso confirmó/anuló el doc, no aplicar efectos.
        const claimed = await tx.document.updateMany({
          where: { id, status: DocumentStatus.draft },
          data: { status: DocumentStatus.confirmed },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden confirmar documentos en borrador',
          );
        }

        await this.effectsRegistry
          .get(document.type)
          .confirm(tx, document, user.sub);
      },
      { timeout: 30000 },
    );

    return this.findOne(id);
  }

  /**
   * La anulación NO usa estrategias: es genérica por diseño — reversa los
   * movimientos kardex registrados y elimina las CxP del documento, sin
   * importar el tipo. Si algún tipo futuro necesita reversa especial,
   * recién ahí se agrega un hook a la estrategia.
   */
  async void(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        inventoryMovements: true,
        accountsPayable: { include: { payablePayments: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden anular documentos confirmados',
      );
    }

    const hasPayments = document.accountsPayable.some(
      (payable) => payable.payablePayments.length > 0,
    );

    if (hasPayments) {
      throw new ConflictException(
        'No se puede anular: la cuenta por pagar ya tiene pagos registrados',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.document.updateMany({
          where: { id, status: DocumentStatus.confirmed },
          data: { status: DocumentStatus.voided },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden anular documentos confirmados',
          );
        }

        // Nota: avgCost/lastCost NO se recalculan al anular — el kardex
        // conserva la trazabilidad (limitación documentada).
        for (const movement of document.inventoryMovements) {
          const quantity = movement.quantity;

          const { previousStock, newStock } = await applyStockChange(tx, {
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            delta: -quantity,
          });

          if (movement.binId) {
            await applyBinStockChange(tx, {
              productId: movement.productId,
              binId: movement.binId,
              warehouseId: movement.warehouseId,
              delta: -quantity,
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: movement.productId,
              warehouseId: movement.warehouseId,
              binId: movement.binId,
              movementType: MovementType.void,
              quantity: -quantity,
              unitCost: movement.unitCost,
              previousStock,
              newStock,
              documentId: id,
              documentItemId: movement.documentItemId,
              userId: user.sub,
            },
          });
        }

        await tx.accountsPayable.deleteMany({ where: { documentId: id } });
      },
      { timeout: 30000 },
    );

    return this.findOne(id);
  }

  async remove(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden eliminar documentos en borrador',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      return tx.document.delete({ where: { id } });
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertDocumentPermission(user: JwtPayload, type: DocumentType) {
    if (!user.permissions.includes(`document.create.${type}`)) {
      throw new ForbiddenException(
        'No tiene permiso para crear documentos de tipo ' + type,
      );
    }
  }

  private computeTotal(items: CreateDocumentItemDto[]) {
    return items.reduce(
      (sum, item) => sum + item.quantity * (item.unitCost ?? 0),
      0,
    );
  }

  private async nextNumber(tx: Prisma.TransactionClient, type: DocumentType) {
    // El zero-padding a 6 dígitos hace que el orden lexicográfico funcione.
    const previous = await tx.document.findFirst({
      where: { type },
      orderBy: { number: 'desc' },
    });

    return String(parseInt(previous?.number ?? '0', 10) + 1).padStart(6, '0');
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryCaseCause,
  InventoryCaseStatus,
  MovementType,
  Prisma,
} from '@prisma/client';
import { DocumentStatus } from '@/common/enums';
import { matchContract } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  InventoryCaseDetail,
  InventoryCaseListResponse,
  InventoryCaseReport,
} from '@/contracts/index';
import {
  CLOSE_MESSAGES,
  CloseInventoryCaseDto,
  FindInventoryCasesDto,
} from './dto/index';
import {
  buildBogotaDayRange,
  buildReport,
  roundToOneDecimal,
  startOfMonthInBogota,
  wholeDaysBetween,
} from './helpers/inventory-case.helpers';

const USER_REF = { select: { id: true, name: true } } as const;
const DOCUMENT_REF = {
  select: { id: true, type: true, number: true },
} as const;

const ROW_INCLUDE = {
  product: {
    select: {
      id: true,
      code: true,
      description: true,
      brand: { select: { name: true } },
    },
  },
  warehouse: { select: { id: true, name: true } },
  document: {
    select: { id: true, type: true, number: true, user: USER_REF },
  },
} satisfies Prisma.InventoryCaseInclude;

const DETAIL_INCLUDE = {
  ...ROW_INCLUDE,
  document: {
    select: {
      id: true,
      type: true,
      number: true,
      notes: true,
      user: USER_REF,
    },
  },
  originDocument: DOCUMENT_REF,
  closedBy: USER_REF,
  reopenedBy: USER_REF,
} satisfies Prisma.InventoryCaseInclude;

const MOVEMENT_SELECT = {
  id: true,
  createdAt: true,
  movementType: true,
  quantity: true,
  previousStock: true,
  newStock: true,
  document: DOCUMENT_REF,
  user: USER_REF,
} satisfies Prisma.InventoryMovementSelect;

type CaseRow = Prisma.InventoryCaseGetPayload<{ include: typeof ROW_INCLUDE }>;

const TRAIL_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const matchListContract = matchContract<InventoryCaseListResponse>();
const matchDetailContract = matchContract<InventoryCaseDetail>();
const matchReportContract = matchContract<InventoryCaseReport>();

@Injectable()
export class InventoryCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findInventoryCasesDto: FindInventoryCasesDto) {
    const { page = 1, limit = 20 } = findInventoryCasesDto;
    const now = new Date();
    const where = this.buildWhere(findInventoryCasesDto);

    const [items, total, openCount, closedThisMonth] =
      await this.prisma.$transaction([
        this.prisma.inventoryCase.findMany({
          where,
          include: ROW_INCLUDE,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.inventoryCase.count({ where }),
        // Los contadores no dependen de los filtros de la bandeja.
        this.prisma.inventoryCase.count({
          where: { status: InventoryCaseStatus.open },
        }),
        this.prisma.inventoryCase.findMany({
          where: {
            status: InventoryCaseStatus.closed,
            closedAt: { gte: startOfMonthInBogota(now) },
          },
          select: { cause: true, createdAt: true, closedAt: true },
        }),
      ]);

    // Los cerrados por anulación del ajuste los cierra el sistema: no miden el trabajo del encargado.
    const worked = closedThisMonth.filter(
      (item) => item.cause !== InventoryCaseCause.ajuste_anulado,
    );
    const totalMs = worked.reduce(
      (sum, item) =>
        sum + (item.closedAt!.getTime() - item.createdAt.getTime()),
      0,
    );

    return matchListContract({
      items: items.map((item) => this.toRow(item, now)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        openCount,
        closedThisMonth: worked.length,
        avgDaysToClose: worked.length
          ? roundToOneDecimal(totalMs / worked.length / DAY_MS)
          : null,
      },
    });
  }

  async getOpenCount() {
    const count = await this.prisma.inventoryCase.count({
      where: { status: InventoryCaseStatus.open },
    });
    return { count };
  }

  async findOne(id: string) {
    const found = await this.prisma.inventoryCase.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!found) throw new NotFoundException('Caso no encontrado');

    const { movements, suggestedOriginDocumentId } =
      await this.findTrail(found);

    return matchDetailContract({
      ...this.toRow(found, new Date()),
      cause: found.cause,
      justification: found.justification,
      originDocument: found.originDocument,
      closedBy: found.closedBy,
      reopenedBy: found.reopenedBy,
      reopenedAt: found.reopenedAt,
      notes: found.document.notes,
      movements,
      suggestedOriginDocumentId,
    });
  }

  async close(
    id: string,
    closeInventoryCaseDto: CloseInventoryCaseDto,
    userId: string,
  ) {
    const { cause, originDocumentId } = closeInventoryCaseDto;

    if (cause === InventoryCaseCause.ajuste_anulado) {
      throw new BadRequestException(CLOSE_MESSAGES.systemCause);
    }

    const justification = closeInventoryCaseDto.justification?.trim();
    if (!justification) {
      throw new BadRequestException(CLOSE_MESSAGES.justificationRequired);
    }
    if (justification.length > 1000) {
      throw new BadRequestException(CLOSE_MESSAGES.justificationTooLong);
    }

    const found = await this.findCaseToChange(id);
    if (found.status !== InventoryCaseStatus.open) {
      throw new ConflictException('El caso ya está cerrado');
    }

    if (originDocumentId) {
      const { movements } = await this.findTrail(found);
      if (
        !movements.some(
          (movement) => movement.document?.id === originDocumentId,
        )
      ) {
        throw new BadRequestException(
          'El documento de origen debe ser uno de los movimientos del caso',
        );
      }
    }

    // El filtro por estado evita que dos personas cierren el mismo caso a la vez.
    const { count } = await this.prisma.inventoryCase.updateMany({
      where: { id, status: InventoryCaseStatus.open },
      data: {
        status: InventoryCaseStatus.closed,
        cause,
        justification,
        originDocumentId: originDocumentId ?? null,
        closedById: userId,
        closedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('El caso ya fue cerrado por otra persona');
    }

    return this.findOne(id);
  }

  async reopen(id: string, userId: string) {
    const found = await this.findCaseToChange(id);
    if (found.status !== InventoryCaseStatus.closed) {
      throw new ConflictException('Solo se pueden reabrir casos cerrados');
    }
    if (found.cause === InventoryCaseCause.ajuste_anulado) {
      throw new BadRequestException(
        'No se puede reabrir un caso cerrado por anulación del ajuste',
      );
    }
    // Cerrado a mano y anulado después: reabrirlo dejaría un caso abierto sobre un ajuste que ya no existe.
    if (found.document.status === DocumentStatus.voided) {
      throw new BadRequestException(
        'No se puede reabrir: el ajuste de este caso fue anulado',
      );
    }

    const { count } = await this.prisma.inventoryCase.updateMany({
      where: { id, status: InventoryCaseStatus.closed },
      data: {
        status: InventoryCaseStatus.open,
        cause: null,
        justification: null,
        originDocumentId: null,
        closedById: null,
        closedAt: null,
        reopenedById: userId,
        reopenedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('El caso ya fue reabierto por otra persona');
    }

    return this.findOne(id);
  }

  async getReport(range: { from: Date; to: Date }, warehouseId: string | null) {
    const day = (date: Date) => date.toISOString().slice(0, 10);
    const cases = await this.prisma.inventoryCase.findMany({
      where: {
        createdAt: buildBogotaDayRange(day(range.from), day(range.to)),
        ...(warehouseId && { warehouseId }),
      },
      select: {
        status: true,
        cause: true,
        quantity: true,
        productId: true,
        warehouseId: true,
        product: { select: { code: true, description: true } },
        warehouse: { select: { name: true } },
        documentItem: { select: { unitCost: true } },
      },
    });

    return matchReportContract(buildReport(cases));
  }

  private buildWhere(
    findInventoryCasesDto: FindInventoryCasesDto,
  ): Prisma.InventoryCaseWhereInput {
    const { status, warehouseId, from, to } = findInventoryCasesDto;
    const search = findInventoryCasesDto.search?.trim();
    const createdAt = buildBogotaDayRange(from, to);

    return {
      ...(status && { status }),
      ...(warehouseId && { warehouseId }),
      ...(createdAt && { createdAt }),
      ...(search && {
        product: {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };
  }

  private toRow(item: CaseRow, now: Date) {
    const { product, document } = item;
    return {
      id: item.id,
      number: item.number,
      createdAt: item.createdAt,
      product: {
        id: product.id,
        code: product.code,
        description: product.description,
        brandName: product.brand.name,
      },
      warehouse: item.warehouse,
      quantity: item.quantity,
      stockBefore: item.stockBefore,
      stockAfter: item.stockAfter,
      adjustmentDocument: {
        id: document.id,
        type: document.type,
        number: document.number,
      },
      adjustedBy: document.user,
      status: item.status,
      closedAt: item.closedAt,
      daysOpen: wholeDaysBetween(item.createdAt, item.closedAt ?? now),
    };
  }

  private async findCaseToChange(id: string) {
    const found = await this.prisma.inventoryCase.findUnique({
      where: { id },
      select: {
        status: true,
        cause: true,
        document: { select: { status: true } },
        productId: true,
        warehouseId: true,
        quantity: true,
        documentItemId: true,
      },
    });
    if (!found) throw new NotFoundException('Caso no encontrado');
    return found;
  }

  /** Pistas del kardex: los últimos movimientos hasta el ajuste (incluido) y, como sugerencia, la salida anterior que sacó justo las unidades ajustadas. */
  private async findTrail(item: {
    productId: string;
    warehouseId: string;
    quantity: number;
    documentItemId: string;
  }) {
    const { productId, warehouseId } = item;
    const adjustment = await this.prisma.inventoryMovement.findFirst({
      where: {
        documentItemId: item.documentItemId,
        productId,
        warehouseId,
        movementType: MovementType.adjustment,
      },
      select: { createdAt: true },
    });
    if (!adjustment) return { movements: [], suggestedOriginDocumentId: null };

    const latest = await this.prisma.inventoryMovement.findMany({
      where: {
        productId,
        warehouseId,
        createdAt: { lte: adjustment.createdAt },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: TRAIL_SIZE,
      select: MOVEMENT_SELECT,
    });

    // Solo entre los movimientos mostrados: close() acepta como origen únicamente esos.
    const origin = latest.find(
      (movement) =>
        movement.createdAt < adjustment.createdAt &&
        movement.quantity === -item.quantity &&
        movement.document,
    );

    return {
      movements: latest.reverse(),
      suggestedOriginDocumentId: origin?.document?.id ?? null,
    };
  }
}

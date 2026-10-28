import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { buildDateColumnRange } from '@/common/utils/date-range.util';
import {
  FindAllDocumentsDto,
  FindPendingOfficialPurchasesDto,
} from './dto/index';
import { getCreditLimitSummary } from './helpers/credit.helpers';
import { withPvStatus } from './helpers/pv-status.helper';

export const DETAIL_INCLUDE = {
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
  // Traemos las marcas del proveedor para que, al editar una compra o devolución,
  // el buscador y el escaneo de productos ya funcionen (sin esto quedan bloqueados).
  thirdParty: {
    select: {
      id: true,
      name: true,
      supplier: {
        select: {
          discountNotes: true,
          brands: {
            where: { active: true },
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  payments: {
    select: { method: true, amount: true },
    orderBy: { createdAt: 'asc' },
  },
  seller: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  customerBranch: {
    select: {
      id: true,
      name: true,
      address: true,
      city: { select: { name: true, department: { select: { name: true } } } },
    },
  },
  user: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  convertedBy: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  destWarehouse: { select: { id: true, name: true } },
  destBin: { include: { zone: { select: { name: true } } } },
  sourceDocument: { select: { id: true, type: true, number: true } },
  derivedDocuments: {
    select: { id: true, type: true, number: true, status: true },
  },
  // Solo en el detalle: los saldos a favor que originó una DVV...
  customerCredits: {
    include: {
      applications: {
        select: {
          id: true,
          amount: true,
          saleDocumentId: true,
          appliedAt: true,
        },
      },
    },
  },
  // ...y, para POS/COT, los saldos a favor que la venta aplicó (con la DVV origen).
  appliedCustomerCredits: {
    include: {
      customerCredit: {
        select: {
          id: true,
          sourceDocument: { select: { id: true, type: true, number: true } },
        },
      },
    },
  },
} satisfies Prisma.DocumentInclude;

// Recortado para el PDF: no trae avgCost a propósito, mezclarlo con el costo real de cada línea daría cifras mal.
const PRINT_INCLUDE = {
  documentItems: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          description: true,
          unitOfMeasure: true,
        },
      },
    },
  },
  thirdParty: {
    select: {
      id: true,
      name: true,
      documentType: true,
      documentNumber: true,
      address: true,
      phone: true,
      city: { select: { name: true, department: { select: { name: true } } } },
    },
  },
  user: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  customerBranch: {
    select: {
      id: true,
      name: true,
      address: true,
      city: { select: { name: true, department: { select: { name: true } } } },
    },
  },
} satisfies Prisma.DocumentInclude;

export type DocumentForPrint = Prisma.DocumentGetPayload<{
  include: typeof PRINT_INCLUDE;
}>;

@Injectable()
export class DocumentsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tipos de documento visibles en el listado: se derivan de los permisos document.create.{TIPO} del usuario. */
  private visibleDocumentTypes(permissions: string[]): DocumentType[] {
    const prefixes = ['document.create.', 'document.void.'];
    const valid = new Set<string>(Object.values(DocumentType));
    const types = permissions.flatMap((p) => {
      const prefix = prefixes.find((pre) => p.startsWith(pre));
      return prefix ? [p.slice(prefix.length)] : [];
    });
    return [...new Set(types)].filter((t): t is DocumentType => valid.has(t));
  }

  async findAll(findAllDocumentsDto: FindAllDocumentsDto, user: JwtPayload) {
    const {
      page = 1,
      limit = 20,
      type,
      types,
      status,
      dateFrom,
      dateTo,
      search,
      thirdPartyId,
    } = findAllDocumentsDto;
    const skip = (page - 1) * limit;

    const typeList = types
      ? (types.split(',').filter(Boolean) as DocumentType[])
      : undefined;

    const requestedTypes = typeList?.length
      ? typeList
      : type
        ? [type]
        : undefined;
    const allowedTypes = this.visibleDocumentTypes(user.permissions);
    // Tipos pedidos se intersecan con los visibles del rol; fuera de alcance da lista vacía, nunca 403.
    const effectiveTypes = requestedTypes
      ? requestedTypes.filter((t) => allowedTypes.includes(t))
      : allowedTypes;

    const where: Prisma.DocumentWhereInput = {
      type: { in: effectiveTypes },
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && { number: { contains: search } }),
      ...(thirdPartyId && { thirdPartyId }),
    };

    const [items, total, draftCount, confirmedCount] =
      await this.prisma.$transaction([
        this.prisma.document.findMany({
          where,
          include: {
            thirdParty: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true } },
            confirmedBy: { select: { id: true, name: true } },
            voidedBy: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
            destWarehouse: { select: { id: true, name: true } },
            derivedDocuments: {
              select: { id: true, type: true, number: true, status: true },
            },
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
      items: items.map((doc) => withPvStatus(doc)),
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

  /** Bandeja de Administración: CM oficiales confirmadas que aún no tienen una CMO confirmada enlazada (los borradores no la ocultan). */
  async findPendingOfficialPurchases(dto: FindPendingOfficialPurchasesDto) {
    const { page = 1, limit = 20, supplierId, search, dateFrom, dateTo } = dto;
    const dateRange = buildDateColumnRange(dateFrom, dateTo);
    const term = search?.trim();

    const where: Prisma.DocumentWhereInput = {
      type: DocumentType.CM,
      status: DocumentStatus.confirmed,
      officialPurchase: true,
      derivedDocuments: {
        none: {
          type: DocumentType.CMO,
          status: DocumentStatus.confirmed,
        },
      },
      ...(supplierId && { thirdPartyId: supplierId }),
      ...((dateFrom || dateTo) && { date: dateRange }),
      ...(term && {
        OR: [
          { number: { contains: term } },
          { supplierInvoiceNumber: { contains: term, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        select: {
          id: true,
          number: true,
          date: true,
          supplierInvoiceNumber: true,
          total: true,
          thirdParty: { select: { id: true, name: true } },
          documentItems: {
            select: {
              productId: true,
              quantity: true,
              unitCost: true,
              product: { select: { id: true, code: true, description: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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

    return withPvStatus(document);
  }

  /** Datos mínimos para el PDF. Solo documentos confirmados: un borrador todavía puede cambiar y un PDF de algo no definitivo confunde. */
  async getDocumentForPrint(id: string): Promise<DocumentForPrint> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: PRINT_INCLUDE,
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (document.status !== DocumentStatus.confirmed) {
      throw new BadRequestException(
        'Solo se pueden imprimir documentos confirmados',
      );
    }

    return document;
  }

  /** Cupo de crédito del cliente: límite, usado y disponible, en pesos. Lo usa la pantalla de venta a crédito. */
  getCreditLimitSummary(customerId: string) {
    return getCreditLimitSummary(this.prisma, customerId);
  }

  /** Saldos a favor del cliente disponibles para aplicar en una venta (distinto del cupo de crédito). */
  async findAvailableCustomerCredits(customerId: string) {
    const credits = await this.prisma.customerCredit.findMany({
      where: { customerId, status: 'available', balance: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        balance: true,
        status: true,
        createdAt: true,
        sourceDocument: {
          select: { id: true, type: true, number: true, date: true },
        },
      },
    });

    const totalAvailable = credits.reduce(
      (sum, credit) => sum + Number(credit.balance),
      0,
    );

    return { credits, totalAvailable };
  }
}

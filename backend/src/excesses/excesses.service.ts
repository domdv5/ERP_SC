import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerCreditKind,
  CustomerCreditUsableIn,
  ExcessVoidReason,
  Prisma,
  SupplierCreditKind,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { matchContract } from '@/common/types';
import type { JwtPayload } from '@/common/types';
import type {
  ExcessItem,
  ExcessListResponse,
  ExcessPartyType,
} from '@/contracts';
import { toCents } from '@/common/utils/money.util';
import { assertValidCalendarDate } from '@/common/utils/date-range.util';
import { CreateExcessDto } from './dto/create-excess.dto';
import { FindAllExcessesDto } from './dto/find-all-excesses.dto';
import { VoidExcessDto } from './dto/void-excess.dto';

const matchExcessContract = matchContract<ExcessItem>();
const matchExcessListContract = matchContract<ExcessListResponse>();

const CUSTOMER_EXCESS_INCLUDE = {
  customer: {
    select: {
      thirdParty: { select: { id: true, name: true, documentNumber: true } },
    },
  },
  customerBranch: { select: { id: true, name: true } },
  applications: {
    where: { customerPayment: { voidedAt: null } },
    select: {
      customerPayment: { select: { id: true, number: true, date: true } },
    },
  },
} satisfies Prisma.CustomerCreditInclude;

const SUPPLIER_EXCESS_INCLUDE = {
  supplier: {
    select: {
      thirdParty: { select: { id: true, name: true, documentNumber: true } },
    },
  },
  applications: {
    where: { supplierPayment: { voidedAt: null } },
    select: {
      supplierPayment: { select: { id: true, number: true, date: true } },
    },
  },
} satisfies Prisma.SupplierCreditInclude;

type CustomerExcessRow = Prisma.CustomerCreditGetPayload<{
  include: typeof CUSTOMER_EXCESS_INCLUDE;
}>;
type SupplierExcessRow = Prisma.SupplierCreditGetPayload<{
  include: typeof SUPPLIER_EXCESS_INCLUDE;
}>;

/** Excedentes (pago de más) de clientes y proveedores: el único lugar donde se registran y anulan. */
@Injectable()
export class ExcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
  ) {}

  async findAll(query: FindAllExcessesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const thirdPartyWhere = {
      thirdParty: {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { documentNumber: { contains: search } },
        ],
      },
    };

    if (query.partyType === 'customer') {
      const where: Prisma.CustomerCreditWhereInput = {
        kind: CustomerCreditKind.excedente,
        ...(query.status ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { number: { contains: search } },
                { customer: thirdPartyWhere },
              ],
            }
          : {}),
      };
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.customerCredit.findMany({
          where,
          include: CUSTOMER_EXCESS_INCLUDE,
          orderBy: [{ number: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.customerCredit.count({ where }),
      ]);
      return matchExcessListContract({
        items: rows.map((row) => this.toCustomerExcess(row)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const where: Prisma.SupplierCreditWhereInput = {
      kind: SupplierCreditKind.excedente,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search } },
              { supplier: thirdPartyWhere },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplierCredit.findMany({
        where,
        include: SUPPLIER_EXCESS_INCLUDE,
        orderBy: [{ number: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplierCredit.count({ where }),
    ]);
    return matchExcessListContract({
      items: rows.map((row) => this.toSupplierExcess(row)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  }

  async create(dto: CreateExcessDto, user: JwtPayload) {
    const thirdParty = await this.prisma.thirdParty.findUnique({
      where: { id: dto.thirdPartyId },
      select: { isCustomer: true, isSupplier: true },
    });
    // Solo un tercero con el rol del tipo elegido puede tener el excedente
    if (dto.partyType === 'customer' && !thirdParty?.isCustomer) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (dto.partyType === 'supplier' && !thirdParty?.isSupplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }
    if (dto.partyType === 'supplier' && dto.customerBranchId) {
      throw new BadRequestException('Los proveedores no tienen sucursales');
    }
    if (dto.customerBranchId) {
      const branch = await this.prisma.customerBranch.findFirst({
        where: { id: dto.customerBranchId, customerId: dto.thirdPartyId },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('La sucursal no pertenece al cliente');
      }
    }

    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Bogota',
    });
    const dateText = dto.date ?? today;
    assertValidCalendarDate('date', dateText);
    if (dateText > today) {
      throw new BadRequestException(
        'La fecha del excedente no puede ser futura',
      );
    }

    const amount = toCents(dto.amount) / 100;
    if (amount <= 0) {
      throw new BadRequestException(
        'El valor del excedente debe ser mayor a 0',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const number = await this.sequenceService.next(tx, 'EXCESS');
      const common = {
        number,
        amount,
        balance: amount,
        status: 'available' as const,
        date: new Date(dateText),
        userId: user.sub,
      };

      if (dto.partyType === 'customer') {
        const created = await tx.customerCredit.create({
          data: {
            ...common,
            customerId: dto.thirdPartyId,
            kind: CustomerCreditKind.excedente,
            usableIn: CustomerCreditUsableIn.administracion,
            customerBranchId: dto.customerBranchId ?? null,
          },
          include: CUSTOMER_EXCESS_INCLUDE,
        });
        return matchExcessContract(this.toCustomerExcess(created));
      }

      const created = await tx.supplierCredit.create({
        data: {
          ...common,
          supplierId: dto.thirdPartyId,
          kind: SupplierCreditKind.excedente,
        },
        include: SUPPLIER_EXCESS_INCLUDE,
      });
      return matchExcessContract(this.toSupplierExcess(created));
    });
  }

  /** Anula un excedente que nunca se usó; queda marcado (no se borra) con su motivo. */
  async void(
    partyType: ExcessPartyType,
    id: string,
    dto: VoidExcessDto,
    user: JwtPayload,
  ) {
    const voidData = {
      status: 'voided' as const,
      balance: 0,
      voidedAt: new Date(),
      voidedById: user.sub,
      voidReason: dto.reason,
      voidReasonOther:
        dto.reason === ExcessVoidReason.otro ? dto.reasonOther!.trim() : null,
    };

    return this.prisma.$transaction(async (tx) => {
      if (partyType === 'customer') {
        // Mismo lock que usa el recibo al aplicarlo: no se anula mientras otro recibo lo usa
        await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ${id}::uuid FOR UPDATE`;
        const credit = await tx.customerCredit.findUnique({
          where: { id },
          include: CUSTOMER_EXCESS_INCLUDE,
        });
        if (!credit || credit.kind !== CustomerCreditKind.excedente) {
          throw new NotFoundException('Excedente no encontrado');
        }
        this.assertCanVoid(credit.status, credit.applications.length, credit);
        const voided = await tx.customerCredit.update({
          where: { id },
          data: voidData,
          include: CUSTOMER_EXCESS_INCLUDE,
        });
        return matchExcessContract(this.toCustomerExcess(voided));
      }

      // Mismo lock que usa el egreso al aplicarlo
      await tx.$queryRaw`SELECT id FROM "supplier_credit" WHERE id = ${id}::uuid FOR UPDATE`;
      const credit = await tx.supplierCredit.findUnique({
        where: { id },
        include: SUPPLIER_EXCESS_INCLUDE,
      });
      if (!credit || credit.kind !== SupplierCreditKind.excedente) {
        throw new NotFoundException('Excedente no encontrado');
      }
      this.assertCanVoid(credit.status, credit.applications.length, credit);
      const voided = await tx.supplierCredit.update({
        where: { id },
        data: voidData,
        include: SUPPLIER_EXCESS_INCLUDE,
      });
      return matchExcessContract(this.toSupplierExcess(voided));
    });
  }

  // Usado = tiene aplicaciones en pagos no anulados o el saldo ya bajó
  private assertCanVoid(
    status: string,
    activeUsages: number,
    credit: { amount: Prisma.Decimal; balance: Prisma.Decimal },
  ) {
    if (status === 'voided') {
      throw new BadRequestException('El excedente ya está anulado');
    }
    if (
      activeUsages > 0 ||
      toCents(credit.balance) !== toCents(credit.amount)
    ) {
      throw new BadRequestException(
        'El excedente ya se usó y no se puede anular',
      );
    }
  }

  private toCustomerExcess(row: CustomerExcessRow) {
    return {
      ...this.toCommonFields(row),
      partyType: 'customer' as const,
      thirdParty: row.customer.thirdParty,
      customerBranch: row.customerBranch,
      usages: row.applications.flatMap((application) =>
        application.customerPayment
          ? [{ documentType: 'RC' as const, ...application.customerPayment }]
          : [],
      ),
    };
  }

  private toSupplierExcess(row: SupplierExcessRow) {
    return {
      ...this.toCommonFields(row),
      partyType: 'supplier' as const,
      thirdParty: row.supplier.thirdParty,
      customerBranch: null,
      usages: row.applications.flatMap((application) =>
        application.supplierPayment
          ? [{ documentType: 'EG' as const, ...application.supplierPayment }]
          : [],
      ),
    };
  }

  // El saldo usado en parte (antes de "completo o nada") se reporta como partial
  private toCommonFields(row: CustomerExcessRow | SupplierExcessRow) {
    const isPartial =
      row.status === 'available' && toCents(row.balance) < toCents(row.amount);
    return {
      id: row.id,
      number: row.number!,
      date: row.date!,
      amount: row.amount,
      balance: row.balance,
      status: isPartial ? ('partial' as const) : row.status,
      voidedAt: row.voidedAt,
      voidReason: row.voidReason,
      voidReasonOther: row.voidReasonOther,
      createdAt: row.createdAt,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FindAllAccountsPayableDto,
  FindAvailableCreditsDto,
} from './dto/index';

const LIST_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: { select: { id: true, type: true, number: true, date: true } },
  // Solo el monto: alcanza para sumar creditApplied sin traer el objeto completo.
  creditApplications: { select: { amount: true } },
} satisfies Prisma.AccountsPayableInclude;

const DETAIL_INCLUDE = {
  supplier: { include: { thirdParty: { select: { id: true, name: true } } } },
  document: { select: { id: true, type: true, number: true, date: true } },
  payablePayments: { orderBy: { paymentDate: 'desc' } },
  creditApplications: {
    include: {
      supplierCredit: { select: { id: true, amount: true, balance: true } },
    },
    orderBy: { appliedAt: 'desc' },
  },
  egresoAllocations: {
    include: { egreso: { select: { id: true, number: true, date: true } } },
  },
} satisfies Prisma.AccountsPayableInclude;

type ListRow = Prisma.AccountsPayableGetPayload<{
  include: typeof LIST_INCLUDE;
}>;
type DetailRow = Prisma.AccountsPayableGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Reparte los campos derivados (abonado, aplicado en nota crédito, saldo) sobre una fila con sus creditApplications ya cargadas. */
function withDerivedFields<
  T extends Pick<ListRow, 'totalAmount' | 'paidAmount' | 'creditApplications'>,
>(row: T) {
  const { creditApplications, ...rest } = row;
  const creditApplied = creditApplications.reduce(
    (sum, application) => sum.plus(application.amount),
    new Prisma.Decimal(0),
  );

  return {
    ...rest,
    creditApplied,
    balance: row.totalAmount.minus(row.paidAmount),
  };
}

@Injectable()
export class AccountsPayableService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findAllAccountsPayableDto: FindAllAccountsPayableDto) {
    const {
      page = 1,
      limit = 20,
      status,
      supplierId,
      search,
    } = findAllAccountsPayableDto;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountsPayableWhereInput = {
      ...(status && { status }),
      ...(supplierId && { supplierId }),
      ...(search && {
        supplier: {
          thirdParty: { name: { contains: search, mode: 'insensitive' } },
        },
      }),
    };

    const [rawItems, total] = await this.prisma.$transaction([
      this.prisma.accountsPayable.findMany({
        where,
        include: LIST_INCLUDE,
        skip,
        take: limit,
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.accountsPayable.count({ where }),
    ]);

    return {
      items: rawItems.map(withDerivedFields),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const accountPayable = await this.prisma.accountsPayable.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!accountPayable) {
      throw new NotFoundException('Cuenta por pagar no encontrada');
    }

    // payablePayments/egresoAllocations/creditApplications ya quedan resumidos
    // en `history` — no se devuelven crudos para no duplicar la misma info.
    const { payablePayments, egresoAllocations, creditApplications, ...rest } =
      accountPayable;
    const creditApplied = creditApplications.reduce(
      (sum, application) => sum.plus(application.amount),
      new Prisma.Decimal(0),
    );

    return {
      ...rest,
      creditApplied,
      balance: accountPayable.totalAmount.minus(accountPayable.paidAmount),
      history: buildHistory(accountPayable),
    };
  }

  /** Estado de cuenta completo del proveedor: todas sus CxP y saldos a favor, con totales. */
  async statement(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { thirdParty: { select: { id: true, name: true } } },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const [rawPayables, rawCredits] = await Promise.all([
      this.prisma.accountsPayable.findMany({
        where: { supplierId },
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplierCredit.findMany({
        where: { supplierId },
        include: {
          sourceDocument: {
            select: { id: true, type: true, number: true, date: true },
          },
          applications: {
            include: {
              egreso: { select: { id: true, number: true, date: true } },
            },
            orderBy: { appliedAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const payables = rawPayables.map(withDerivedFields);

    const totalDebt = payables.reduce(
      (sum, payable) => sum.plus(payable.totalAmount),
      new Prisma.Decimal(0),
    );
    const totalPaid = payables.reduce(
      (sum, payable) => sum.plus(payable.paidAmount),
      new Prisma.Decimal(0),
    );
    const availableCredit = rawCredits
      .filter((credit) => credit.status === 'available')
      .reduce((sum, credit) => sum.plus(credit.balance), new Prisma.Decimal(0));

    return {
      supplier: {
        id: supplier.thirdParty.id,
        name: supplier.thirdParty.name,
      },
      totals: {
        totalDebt,
        totalPaid,
        totalBalance: totalDebt.minus(totalPaid),
        availableCredit,
      },
      payables,
      credits: rawCredits,
    };
  }

  /** Créditos de proveedor con saldo disponible para aplicar contra un pago. */
  async findAvailableCredits(findAvailableCreditsDto: FindAvailableCreditsDto) {
    const { supplierId } = findAvailableCreditsDto;

    return this.prisma.supplierCredit.findMany({
      where: { supplierId, status: 'available', balance: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

/** Historial unificado de abonos de una CxP: egresos, pagos históricos y aplicaciones de saldo a favor sin egreso (las que ya tienen egreso se excluyen para no duplicar). */
function buildHistory(accountPayable: DetailRow) {
  const fromEgresos = accountPayable.egresoAllocations.map((allocation) => ({
    source: 'egreso' as const,
    date: allocation.egreso.date,
    amount: allocation.amount,
    creditAmount: allocation.creditAmount,
    egreso: allocation.egreso,
  }));

  const fromHistoricPayments = accountPayable.payablePayments.map(
    (payment) => ({
      source: 'pago_historico' as const,
      date: payment.paymentDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      bankDestination: payment.bankDestination,
      reference: payment.reference,
    }),
  );

  const fromHistoricCredits = accountPayable.creditApplications
    .filter((application) => application.egresoId === null)
    .map((application) => ({
      source: 'nota_credito_historica' as const,
      date: application.appliedAt,
      amount: application.amount,
      supplierCredit: application.supplierCredit,
    }));

  return [...fromEgresos, ...fromHistoricPayments, ...fromHistoricCredits].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

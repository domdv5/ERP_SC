import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { matchContract } from '@/common/types/as-json';
import type {
  CreditListResponse,
  CustomerCreditsDetail,
  SupplierCreditsDetail,
} from '@/contracts/credits';
import { FindCreditsDto } from './dto/index';
import {
  buildSearchFilter,
  calculateAvailableTotal,
  calculateUsed,
  deriveCreditStatus,
} from './credits.helpers';

const matchListContract = matchContract<CreditListResponse>();
const matchCustomerDetailContract = matchContract<CustomerCreditsDetail>();
const matchSupplierDetailContract = matchContract<SupplierCreditsDetail>();

const AVAILABLE_CUSTOMER_CREDIT = {
  voidedAt: null,
  status: { not: 'voided' },
  balance: { gt: 0 },
} satisfies Prisma.CustomerCreditWhereInput;

const AVAILABLE_SUPPLIER_CREDIT = {
  balance: { gt: 0 },
} satisfies Prisma.SupplierCreditWhereInput;

// Las aplicaciones de un egreso anulado no cuentan como uso.
const ACTIVE_SUPPLIER_APPLICATION = {
  OR: [{ supplierPaymentId: null }, { supplierPayment: { voidedAt: null } }],
} satisfies Prisma.SupplierCreditApplicationWhereInput;

const THIRD_PARTY_SELECT = {
  id: true,
  name: true,
  documentNumber: true,
} as const;

const SOURCE_DOCUMENT_SELECT = {
  select: { type: true, number: true, date: true },
} as const;

// Las aplicaciones de un recibo anulado no cuentan como uso.
const ACTIVE_CUSTOMER_APPLICATION = {
  OR: [{ reciboCajaId: null }, { reciboCaja: { voidedAt: null } }],
} satisfies Prisma.CustomerCreditApplicationWhereInput;

const CUSTOMER_CREDIT_INCLUDE = {
  sourceDocument: SOURCE_DOCUMENT_SELECT,
  customerBranch: { select: { name: true } },
  applications: {
    where: ACTIVE_CUSTOMER_APPLICATION,
    include: {
      saleDocument: { select: { type: true, number: true } },
      reciboCaja: { select: { number: true } },
    },
    orderBy: { appliedAt: 'desc' },
  },
} satisfies Prisma.CustomerCreditInclude;

const SUPPLIER_CREDIT_INCLUDE = {
  sourceDocument: SOURCE_DOCUMENT_SELECT,
  applications: {
    where: ACTIVE_SUPPLIER_APPLICATION,
    include: { supplierPayment: { select: { number: true } } },
    orderBy: { appliedAt: 'desc' },
  },
} satisfies Prisma.SupplierCreditInclude;

type CustomerCreditRow = Prisma.CustomerCreditGetPayload<{
  include: typeof CUSTOMER_CREDIT_INCLUDE;
}>;
type SupplierCreditRow = Prisma.SupplierCreditGetPayload<{
  include: typeof SUPPLIER_CREDIT_INCLUDE;
}>;

interface CreditAmounts {
  amount: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: string;
  voidedAt?: Date | null;
}

function buildListItem(
  id: string,
  thirdParty: { name: string; documentNumber: string },
  credits: CreditAmounts[],
) {
  return {
    id,
    name: thirdParty.name,
    documentNumber: thirdParty.documentNumber,
    creditCount: credits.length,
    availableTotal: calculateAvailableTotal(credits),
  };
}

function buildMeta(total: number, page: number, limit: number) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

function buildOrigin(
  kind: 'devolucion' | 'excedente',
  sourceDocument: { type: string; number: string } | null,
) {
  return {
    kind,
    documentType: sourceDocument?.type ?? null,
    documentNumber: sourceDocument?.number ?? null,
  };
}

function buildCreditBase(
  credit: CreditAmounts & {
    id: string;
    createdAt: Date;
    date?: Date | null;
    sourceDocument: { date: Date } | null;
  },
) {
  return {
    id: credit.id,
    date: credit.sourceDocument?.date ?? credit.date ?? credit.createdAt,
    amount: credit.amount,
    used: calculateUsed(credit),
    balance: credit.balance,
    status: deriveCreditStatus(credit),
    voidedAt: credit.voidedAt ?? null,
  };
}

function buildCustomerCredit(credit: CustomerCreditRow) {
  return {
    ...buildCreditBase(credit),
    origin: buildOrigin(credit.kind, credit.sourceDocument),
    usableIn: credit.usableIn,
    branchName: credit.customerBranch?.name ?? null,
    applications: credit.applications.map((application) => ({
      id: application.id,
      documentType: application.saleDocument?.type ?? 'RC',
      documentNumber:
        application.saleDocument?.number ??
        application.reciboCaja?.number ??
        null,
      amount: application.amount,
      date: application.appliedAt,
    })),
  };
}

function buildSupplierCredit(credit: SupplierCreditRow) {
  return {
    ...buildCreditBase(credit),
    origin: buildOrigin('devolucion', credit.sourceDocument),
    applications: credit.applications.map((application) => ({
      id: application.id,
      documentType: application.supplierPayment ? 'EG' : null,
      documentNumber: application.supplierPayment?.number ?? null,
      amount: application.amount,
      date: application.appliedAt,
    })),
  };
}

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCustomers(findCreditsDto: FindCreditsDto) {
    const { page = 1, limit = 20, search, onlyAvailable } = findCreditsDto;
    const where: Prisma.CustomerWhereInput = {
      customerCredits: {
        some: onlyAvailable ? AVAILABLE_CUSTOMER_CREDIT : {},
      },
      thirdParty: buildSearchFilter(search),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          thirdParty: { select: THIRD_PARTY_SELECT },
          customerCredits: {
            select: {
              amount: true,
              balance: true,
              status: true,
              voidedAt: true,
            },
          },
        },
        orderBy: [{ thirdParty: { name: 'asc' } }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return matchListContract({
      items: rows.map((row) =>
        buildListItem(row.id, row.thirdParty, row.customerCredits),
      ),
      meta: buildMeta(total, page, limit),
    });
  }

  async findSuppliers(findCreditsDto: FindCreditsDto) {
    const { page = 1, limit = 20, search, onlyAvailable } = findCreditsDto;
    const where: Prisma.SupplierWhereInput = {
      supplierCredits: { some: onlyAvailable ? AVAILABLE_SUPPLIER_CREDIT : {} },
      thirdParty: buildSearchFilter(search),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        select: {
          id: true,
          thirdParty: { select: THIRD_PARTY_SELECT },
          supplierCredits: {
            select: { amount: true, balance: true, status: true },
          },
        },
        orderBy: [{ thirdParty: { name: 'asc' } }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return matchListContract({
      items: rows.map((row) =>
        buildListItem(row.id, row.thirdParty, row.supplierCredits),
      ),
      meta: buildMeta(total, page, limit),
    });
  }

  async findCustomerDetail(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        thirdParty: { select: THIRD_PARTY_SELECT },
        customerCredits: {
          include: CUSTOMER_CREDIT_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return matchCustomerDetailContract({
      customer: {
        id: customer.thirdParty.id,
        name: customer.thirdParty.name,
        documentNumber: customer.thirdParty.documentNumber,
        availableTotal: calculateAvailableTotal(customer.customerCredits),
      },
      credits: customer.customerCredits.map(buildCustomerCredit),
    });
  }

  async findSupplierDetail(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        thirdParty: { select: THIRD_PARTY_SELECT },
        supplierCredits: {
          include: SUPPLIER_CREDIT_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    return matchSupplierDetailContract({
      supplier: {
        id: supplier.thirdParty.id,
        name: supplier.thirdParty.name,
        documentNumber: supplier.thirdParty.documentNumber,
        availableTotal: calculateAvailableTotal(supplier.supplierCredits),
      },
      credits: supplier.supplierCredits.map(buildSupplierCredit),
    });
  }
}

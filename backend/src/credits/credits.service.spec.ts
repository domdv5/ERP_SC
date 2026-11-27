import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreditsService } from './credits.service';

const money = (value: number) => new Prisma.Decimal(value);

describe('CreditsService', () => {
  const prisma = {
    customer: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    supplier: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CreditsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.customer.count.mockResolvedValue(0);
    prisma.supplier.findMany.mockResolvedValue([]);
    prisma.supplier.count.mockResolvedValue(0);
  });

  it('busca por nombre O documento, sin distinguir mayúsculas', async () => {
    await service.findCustomers({ search: ' Perez ' });

    expect(prisma.customer.findMany.mock.calls[0][0].where.thirdParty).toEqual({
      OR: [
        { name: { contains: 'Perez', mode: 'insensitive' } },
        { documentNumber: { contains: 'Perez', mode: 'insensitive' } },
      ],
    });
  });

  it('onlyAvailable exige algún saldo no anulado con balance > 0', async () => {
    await service.findCustomers({ onlyAvailable: true });
    await service.findSuppliers({ onlyAvailable: true });

    expect(
      prisma.customer.findMany.mock.calls[0][0].where.customerCredits,
    ).toEqual({
      some: { voidedAt: null, status: { not: 'voided' }, balance: { gt: 0 } },
    });
    expect(
      prisma.supplier.findMany.mock.calls[0][0].where.supplierCredits,
    ).toEqual({ some: { status: { not: 'voided' }, balance: { gt: 0 } } });
  });

  it('el detalle de proveedor marca el origen excedente y deja el anulado en voided con total 0', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      thirdParty: { id: 's1', name: 'Prov', documentNumber: '9' },
      supplierCredits: [
        {
          id: 'x1',
          kind: 'excedente',
          status: 'voided',
          amount: money(100),
          balance: money(0),
          voidedAt: new Date('2026-11-02'),
          date: new Date('2026-11-01'),
          createdAt: new Date('2026-11-01'),
          sourceDocument: null,
          applications: [],
        },
      ],
    });

    const result = await service.findSupplierDetail('s1');

    expect(result.credits[0].origin).toEqual({
      kind: 'excedente',
      documentType: null,
      documentNumber: null,
    });
    expect(result.credits[0].status).toBe('voided');
    expect(result.supplier.availableTotal.toString()).toBe('0');
  });

  it('sin onlyAvailable lista todo tercero con algún saldo, usado o anulado', async () => {
    await service.findCustomers({});

    expect(
      prisma.customer.findMany.mock.calls[0][0].where.customerCredits,
    ).toEqual({ some: {} });
  });

  it('el total disponible de la lista excluye anulados y saldos en cero', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'c1',
        thirdParty: { name: 'Ana', documentNumber: '1' },
        customerCredits: [
          {
            amount: money(100),
            balance: money(60),
            status: 'available',
            voidedAt: null,
          },
          {
            amount: money(80),
            balance: money(0),
            status: 'used',
            voidedAt: null,
          },
          {
            amount: money(500),
            balance: money(500),
            status: 'voided',
            voidedAt: new Date(),
          },
        ],
      },
    ]);
    prisma.customer.count.mockResolvedValue(1);

    const result = await service.findCustomers({});

    expect(result.items[0].creditCount).toBe(3);
    expect(result.items[0].availableTotal.toString()).toBe('60');
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('el detalle de proveedor deja fuera aplicaciones de egresos anulados', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      thirdParty: { id: 's1', name: 'Prov', documentNumber: '9' },
      supplierCredits: [],
    });

    await service.findSupplierDetail('s1');

    const include =
      prisma.supplier.findUnique.mock.calls[0][0].select.supplierCredits
        .include;
    expect(include.applications.where).toEqual({
      OR: [
        { supplierPaymentId: null },
        { supplierPayment: { voidedAt: null } },
      ],
    });
  });

  it('el detalle de cliente deja fuera aplicaciones de recibos anulados', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      thirdParty: { id: 'c1', name: 'Ana', documentNumber: '1' },
      customerCredits: [],
    });

    await service.findCustomerDetail('c1');

    const include =
      prisma.customer.findUnique.mock.calls[0][0].select.customerCredits
        .include;
    expect(include.applications.where).toEqual({
      OR: [
        { customerPaymentId: null },
        { customerPayment: { voidedAt: null } },
      ],
    });
  });

  it('el detalle de cliente calcula estado, usado y total sin contar anulados', async () => {
    const base = { createdAt: new Date(), date: null, sourceDocument: null };
    prisma.customer.findUnique.mockResolvedValue({
      thirdParty: { id: 'c1', name: 'Ana', documentNumber: '1' },
      customerCredits: [
        {
          ...base,
          id: 'a',
          kind: 'excedente',
          usableIn: 'administracion',
          amount: money(100),
          balance: money(40),
          status: 'available',
          voidedAt: null,
          customerBranch: null,
          applications: [],
        },
        {
          ...base,
          id: 'b',
          kind: 'excedente',
          usableIn: 'administracion',
          amount: money(200),
          balance: money(200),
          status: 'voided',
          voidedAt: new Date(),
          customerBranch: null,
          applications: [],
        },
      ],
    });

    const result = await service.findCustomerDetail('c1');

    expect(result.credits.map((credit) => credit.status)).toEqual([
      'partial',
      'voided',
    ]);
    expect(result.credits[0].used.toString()).toBe('60');
    expect(result.credits[1].used.toString()).toBe('0');
    expect(result.credits[0].origin.documentNumber).toBeNull();
    expect(result.customer.availableTotal.toString()).toBe('40');
  });

  it('404 si el tercero no existe', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.supplier.findUnique.mockResolvedValue(null);

    await expect(service.findCustomerDetail('x')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.findSupplierDetail('x')).rejects.toThrow(
      NotFoundException,
    );
  });
});

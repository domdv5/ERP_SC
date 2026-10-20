import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentType } from '@/common/enums';
import { BaseEffectStrategy } from './base-effect.strategy';

const MISSING_MESSAGE = 'La venta requiere indicar la sucursal del cliente';
const INVALID_MESSAGE = 'La sucursal no pertenece al cliente';

class TestStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.COT;
  async confirm() {}
  check(customerId?: string | null, customerBranchId?: string | null) {
    return this.assertValidCustomerBranch(customerId, customerBranchId);
  }
}

describe('BaseEffectStrategy: sucursal del cliente', () => {
  const prisma = { customerBranch: { findMany: jest.fn() } };
  const strategy = new TestStrategy(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('rechaza una venta sin sucursal si el cliente tiene sucursales activas', async () => {
    prisma.customerBranch.findMany.mockResolvedValue([{ id: 'br-1' }]);

    await expect(strategy.check('cus-1', undefined)).rejects.toThrow(
      new BadRequestException(MISSING_MESSAGE),
    );
  });

  it('rechaza una sucursal que no está entre las activas del cliente', async () => {
    prisma.customerBranch.findMany.mockResolvedValue([{ id: 'br-1' }]);

    await expect(strategy.check('cus-1', 'br-otro')).rejects.toThrow(
      new BadRequestException(INVALID_MESSAGE),
    );
  });

  it('rechaza una sucursal cuando el cliente no tiene sucursales activas', async () => {
    prisma.customerBranch.findMany.mockResolvedValue([]);

    await expect(strategy.check('cus-1', 'br-1')).rejects.toThrow(
      new BadRequestException(INVALID_MESSAGE),
    );
  });

  it('acepta una sucursal activa del cliente', async () => {
    prisma.customerBranch.findMany.mockResolvedValue([
      { id: 'br-1' },
      { id: 'br-2' },
    ]);

    await expect(strategy.check('cus-1', 'br-2')).resolves.toBeUndefined();
    expect(prisma.customerBranch.findMany).toHaveBeenCalledWith({
      where: { customerId: 'cus-1', active: true },
      select: { id: true },
    });
  });

  it('acepta una venta sin sucursal si el cliente no tiene sucursales', async () => {
    prisma.customerBranch.findMany.mockResolvedValue([]);

    await expect(strategy.check('cus-1', null)).resolves.toBeUndefined();
  });
});

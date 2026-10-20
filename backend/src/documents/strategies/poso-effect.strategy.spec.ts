import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BRANCH_TYPES } from '@/documents/helpers/customer-branch.helpers';
import { PosoEffectStrategy } from './poso-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

const MISSING_MESSAGE = 'La venta requiere indicar la sucursal del cliente';

describe('PosoEffectStrategy: sucursal del cliente', () => {
  const prisma = { customerBranch: { findMany: jest.fn() } };
  const strategy = new PosoEffectStrategy(prisma as unknown as PrismaService);
  const tx = {} as Prisma.TransactionClient;

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(
        strategy as unknown as { validateCashSale: () => Promise<void> },
        'validateCashSale',
      )
      .mockResolvedValue();
    prisma.customerBranch.findMany.mockResolvedValue([{ id: 'br-1' }]);
  });

  it('guarda la sucursal en el POS oficial', () => {
    expect(BRANCH_TYPES.has(DocumentType.POSO)).toBe(true);
  });

  it('validateCreate exige la sucursal si el cliente tiene sucursales', async () => {
    await expect(
      strategy.validateCreate({
        thirdPartyId: 'cus-1',
        items: [],
      } as unknown as CreateDocumentDto),
    ).rejects.toThrow(new BadRequestException(MISSING_MESSAGE));
  });

  it('confirm vuelve a exigir la sucursal', async () => {
    const document = {
      thirdPartyId: 'cus-1',
      customerBranchId: null,
      documentItems: [],
    } as unknown as DocumentWithItems;

    await expect(strategy.confirm(tx, document, 'user-1')).rejects.toThrow(
      new BadRequestException(MISSING_MESSAGE),
    );
  });

  it('acepta una sucursal activa del cliente', async () => {
    await expect(
      strategy.validateCreate({
        thirdPartyId: 'cus-1',
        customerBranchId: 'br-1',
        items: [],
      } as unknown as CreateDocumentDto),
    ).resolves.toBeUndefined();
  });
});

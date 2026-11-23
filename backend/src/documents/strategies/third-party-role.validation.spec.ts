import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentType } from '@/common/enums';
import type { CreateDocumentDto } from '../dto/create-document.dto';
import { BaseEffectStrategy } from './base-effect.strategy';
import { CotEffectStrategy } from './cot-effect.strategy';
import { PvEffectStrategy } from './pv-effect.strategy';

class TestStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.POS;
  async confirm() {}
  checkSupplier(id: string) {
    return this.assertValidSupplier(id);
  }
  checkCustomer(id: string) {
    return this.assertValidCustomer(id);
  }
  checkCashSale(dto: CreateDocumentDto) {
    return this.validateCashSale(dto);
  }
}

describe('BaseEffectStrategy: tercero desmarcado como cliente o proveedor', () => {
  const prisma = { thirdParty: { findUnique: jest.fn() } };
  const strategy = new TestStrategy(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('rechaza una compra a un tercero con registro de proveedor pero sin la casilla', async () => {
    prisma.thirdParty.findUnique.mockResolvedValue({
      isSupplier: false,
      supplier: { id: 'tp-1' },
    });

    await expect(strategy.checkSupplier('tp-1')).rejects.toThrow(
      new BadRequestException('El documento requiere un proveedor válido'),
    );
  });

  it('rechaza un documento a un tercero con registro de cliente pero sin la casilla', async () => {
    prisma.thirdParty.findUnique.mockResolvedValue({
      isCustomer: false,
      customer: { id: 'tp-1' },
    });

    await expect(strategy.checkCustomer('tp-1')).rejects.toThrow(
      new BadRequestException('El documento requiere un cliente válido'),
    );
  });

  it('rechaza una venta de contado a un tercero con registro de cliente pero sin la casilla', async () => {
    prisma.thirdParty.findUnique.mockResolvedValue({
      isCustomer: false,
      customer: { id: 'tp-1' },
    });

    await expect(
      strategy.checkCashSale({
        thirdPartyId: 'tp-1',
        sellerId: 'sel-1',
        items: [],
      } as unknown as CreateDocumentDto),
    ).rejects.toThrow(
      new BadRequestException('La venta requiere un cliente válido'),
    );
  });

  it('rechaza una preventa o una COT a un tercero con registro de cliente pero sin la casilla', async () => {
    prisma.thirdParty.findUnique.mockResolvedValue({
      isCustomer: false,
      customer: { id: 'tp-1' },
    });
    const dto = {
      thirdPartyId: 'tp-1',
      sellerId: 'sel-1',
      items: [],
    } as unknown as CreateDocumentDto;
    const service = prisma as unknown as PrismaService;

    await expect(
      new PvEffectStrategy(service).validateCreate(dto),
    ).rejects.toThrow(
      new BadRequestException('La preventa requiere un cliente válido'),
    );
    await expect(
      new CotEffectStrategy(service).validateCreate(dto),
    ).rejects.toThrow(
      new BadRequestException('La venta requiere un cliente válido'),
    );
  });

  it('acepta un proveedor y un cliente con la casilla marcada', async () => {
    prisma.thirdParty.findUnique.mockResolvedValue({
      isSupplier: true,
      isCustomer: true,
      supplier: { id: 'tp-1' },
      customer: { id: 'tp-1' },
    });

    await expect(strategy.checkSupplier('tp-1')).resolves.toBeUndefined();
    await expect(strategy.checkCustomer('tp-1')).resolves.toBeUndefined();
  });
});

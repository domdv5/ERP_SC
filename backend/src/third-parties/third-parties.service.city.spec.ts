import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import type { CreateThirdPartyDto } from './dto/create-third-party.dto';

const USER: JwtPayload = {
  sub: 'u-1',
  name: 'Admin',
  username: 'admin',
  permissions: ['thirdparty.role.customer'],
  roles: [],
};

describe('ThirdPartiesService guarda la ciudad', () => {
  const thirdPartyCreate = jest.fn();
  const customerCreate = jest.fn();
  const findUnique = jest.fn();
  const branchUpdate = jest.fn();
  const tx = {
    thirdParty: { create: thirdPartyCreate },
    customer: { create: customerCreate },
  };
  const service = new ThirdPartiesService({
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    thirdParty: { findUnique },
    customerBranch: { update: branchUpdate },
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('create guarda cityCode del tercero y de sus sucursales', async () => {
    thirdPartyCreate.mockResolvedValue({ id: 'tp-1' });
    customerCreate.mockResolvedValue({ id: 'tp-1' });

    await service.create(
      {
        personType: 'juridica',
        documentType: 'NIT',
        documentNumber: '900',
        name: 'Cliente',
        cityCode: '05001',
        isCustomer: true,
        branches: [{ name: 'Cali', cityCode: '76001' }],
      } as CreateThirdPartyDto,
      USER,
    );

    expect(thirdPartyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ cityCode: '05001' }) as unknown,
    });
    expect(customerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branches: {
          createMany: { data: [{ name: 'Cali', cityCode: '76001' }] },
        },
      }) as unknown,
    });
  });

  it('updateBranch guarda y vacía cityCode de la sucursal', async () => {
    findUnique.mockResolvedValue({ isCustomer: true });

    await service.updateBranch('tp-1', 'br-1', { cityCode: '76001' }, USER);
    await service.updateBranch('tp-1', 'br-1', { cityCode: null }, USER);

    expect(branchUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'br-1', customerId: 'tp-1' },
      data: { cityCode: '76001' },
    });
    expect(branchUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'br-1', customerId: 'tp-1' },
      data: { cityCode: null },
    });
  });
});

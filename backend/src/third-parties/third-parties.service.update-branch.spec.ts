import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';

const USER: JwtPayload = {
  sub: 'u-1',
  name: 'Admin',
  username: 'admin',
  permissions: ['thirdparty.role.customer'],
  roles: [],
  tokenVersion: 0,
};

describe('ThirdPartiesService.updateBranch', () => {
  it('solo edita la sucursal si pertenece al cliente indicado', async () => {
    const branchUpdate = jest.fn();
    const service = new ThirdPartiesService({
      thirdParty: {
        findUnique: jest.fn().mockResolvedValue({ isCustomer: true }),
      },
      customerBranch: { update: branchUpdate },
    } as unknown as PrismaService);

    await service.updateBranch('tp-1', 'br-1', { cityCode: '76001' }, USER);

    expect(branchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'br-1', customerId: 'tp-1' } }),
    );
  });
});

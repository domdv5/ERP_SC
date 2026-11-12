import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { getCreditLimitSummaries } from '@/documents/helpers/credit.helpers';

jest.mock('@/documents/helpers/credit.helpers');

const mockedSummaries = jest.mocked(getCreditLimitSummaries);

const sellerUser = {
  permissions: ['thirdparty.read', 'document.create.COT'],
} as JwtPayload;
const readOnlyUser = { permissions: ['thirdparty.read'] } as JwtPayload;

describe('ThirdPartiesService.findAll — cupo del cliente', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const service = new ThirdPartiesService({
    thirdParty: { findMany, count },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([
      { id: 'c1', customer: { id: 'c1' } },
      { id: 's1', customer: null },
    ]);
    count.mockReset().mockResolvedValue(2);
    mockedSummaries
      .mockReset()
      .mockResolvedValue(
        new Map([
          ['c1', { creditLimit: 1000, usedCredit: 400, availableCredit: 600 }],
        ]),
      );
  });

  it('con permiso y filtro de clientes agrega el cupo solo a los clientes', async () => {
    const result = await service.findAll({ isCustomer: true }, sellerUser);

    expect(mockedSummaries).toHaveBeenCalledWith(expect.anything(), ['c1']);
    expect(result.items[0].credit).toEqual({
      creditLimit: 1000,
      usedCredit: 400,
      availableCredit: 600,
    });
    expect(result.items[1]).not.toHaveProperty('credit');
  });

  it('sin permiso de crédito no agrega cupo ni lo consulta', async () => {
    const result = await service.findAll({ isCustomer: true }, readOnlyUser);

    expect(mockedSummaries).not.toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty('credit');
  });

  it('con permiso pero sin filtro de clientes no agrega cupo', async () => {
    const result = await service.findAll({}, sellerUser);

    expect(mockedSummaries).not.toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty('credit');
  });
});

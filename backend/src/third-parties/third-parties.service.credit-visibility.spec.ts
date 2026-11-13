import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import type { CreateThirdPartyDto } from './dto/index';

jest.mock('@/documents/helpers/credit.helpers', () => ({
  getCreditLimitSummaries: jest.fn().mockResolvedValue(new Map()),
}));

const userWith = (permissions: string[]) =>
  ({ sub: 'u-1', permissions }) as unknown as JwtPayload;

const WAREHOUSE = userWith([
  'thirdparty.read',
  'thirdparty.update',
  'thirdparty.role.customer',
]);
const CARTERA = userWith([
  'thirdparty.read',
  'thirdparty.create',
  'thirdparty.update',
  'thirdparty.role.customer',
  'customer.credit.update',
]);
const SELLER = userWith([
  'thirdparty.read',
  'thirdparty.update',
  'thirdparty.role.customer',
  'document.create.COT',
]);

const row = () => ({
  id: 'c1',
  isCustomer: true,
  customer: { id: 'c1', creditLimit: '500000' },
});

describe('ThirdPartiesService — cupo oculto por rol', () => {
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const count = jest.fn();
  const txUpdate = jest.fn();
  const txFindUniqueOrThrow = jest.fn();
  const txCreate = jest.fn();
  const customerCreate = jest.fn();
  const tx = {
    thirdParty: {
      update: txUpdate,
      findUniqueOrThrow: txFindUniqueOrThrow,
      create: txCreate,
    },
    customer: { create: customerCreate },
  };
  const service = new ThirdPartiesService({
    thirdParty: { findMany, findUnique, count },
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([row()]);
    count.mockReset().mockResolvedValue(1);
    findUnique.mockReset().mockResolvedValue(row());
    txUpdate.mockReset().mockResolvedValue({ isCustomer: true });
    txFindUniqueOrThrow.mockReset().mockImplementation(async () => row());
    txCreate.mockReset().mockResolvedValue({ id: 'c1', isCustomer: true });
    customerCreate
      .mockReset()
      .mockResolvedValue({ id: 'c1', creditLimit: '500000' });
  });

  describe('findAll', () => {
    it('sin permiso de cupo devuelve creditLimit null', async () => {
      const { items } = await service.findAll({}, WAREHOUSE);
      expect(items[0].customer?.creditLimit).toBeNull();
    });

    it.each([
      ['customer.credit.update', CARTERA],
      ['document.create.COT', SELLER],
    ])('con %s devuelve el cupo real', async (_permission, user) => {
      const { items } = await service.findAll({}, user);
      expect(items[0].customer?.creditLimit).toBe('500000');
    });
  });

  describe('findOne', () => {
    it('sin permiso de cupo devuelve creditLimit null', async () => {
      const result = await service.findOne('c1', WAREHOUSE);
      expect(result.customer?.creditLimit).toBeNull();
    });

    it.each([
      ['customer.credit.update', CARTERA],
      ['document.create.COT', SELLER],
    ])('con %s devuelve el cupo real', async (_permission, user) => {
      const result = await service.findOne('c1', user);
      expect(result.customer?.creditLimit).toBe('500000');
    });
  });

  describe('create', () => {
    const dto = {
      isCustomer: true,
      name: 'Cliente',
    } as unknown as CreateThirdPartyDto;

    it('sin permiso de cupo devuelve creditLimit null', async () => {
      const result = await service.create(
        dto,
        userWith(['thirdparty.create', 'thirdparty.role.customer']),
      );
      expect(result.customer?.creditLimit).toBeNull();
    });

    it.each([
      ['customer.credit.update', CARTERA],
      [
        'document.create.COT',
        userWith([
          'thirdparty.create',
          'thirdparty.role.customer',
          'document.create.COT',
        ]),
      ],
    ])('con %s devuelve el cupo real', async (_permission, user) => {
      const result = await service.create(dto, user);
      expect(result.customer?.creditLimit).toBe('500000');
    });
  });

  describe('update', () => {
    it('sin permiso de cupo devuelve creditLimit null', async () => {
      findUnique.mockResolvedValue({ isCustomer: true });
      const result = await service.update('c1', { discount: 5 }, WAREHOUSE);
      expect(result.customer?.creditLimit).toBeNull();
    });

    it.each([
      ['customer.credit.update', CARTERA],
      ['document.create.COT', SELLER],
    ])('con %s devuelve el cupo real', async (_permission, user) => {
      findUnique.mockResolvedValue({ isCustomer: true });
      const result = await service.update('c1', { discount: 5 }, user);
      expect(result.customer?.creditLimit).toBe('500000');
    });

    it('sin permiso y sin creditLimit en el DTO no manda creditLimit al upsert', async () => {
      findUnique.mockResolvedValue({ isCustomer: true });
      await service.update('c1', { isCustomer: true, discount: 5 }, WAREHOUSE);

      const { data } = txUpdate.mock.calls[0][0] as {
        data: {
          customer: {
            upsert: {
              create: { creditLimit?: number };
              update: { creditLimit?: number };
            };
          };
        };
      };
      expect(data.customer.upsert.update.creditLimit).toBeUndefined();
      expect(data.customer.upsert.create.creditLimit).toBeUndefined();
    });
  });
});

import { ForbiddenException } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import type { CreateThirdPartyDto, UpdateThirdPartyDto } from './dto/index';

const BILLING = [
  'thirdparty.create',
  'thirdparty.update',
  'thirdparty.role.customer',
];
const ACCOUNTS = [...BILLING, 'customer.credit.update'];

const userWith = (permissions: string[]) =>
  ({ sub: 'u-1', permissions }) as unknown as JwtPayload;

describe('ThirdPartiesService — límite de crédito', () => {
  const findUnique = jest.fn();
  const $transaction = jest.fn();
  const service = new ThirdPartiesService({
    thirdParty: { findUnique },
    $transaction,
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue({ isCustomer: true });
    $transaction.mockReset().mockResolvedValue('ok');
  });

  it('update rechaza creditLimit sin customer.credit.update y no escribe', async () => {
    const call = service.update(
      'tp-1',
      { isCustomer: true, creditLimit: 500000 } as UpdateThirdPartyDto,
      userWith(BILLING),
    );

    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call).rejects.toThrow(
      'No tiene permiso para modificar el límite de crédito.',
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it('create rechaza creditLimit sin customer.credit.update y no escribe', async () => {
    const call = service.create(
      {
        isCustomer: true,
        creditLimit: 500000,
        name: 'Cliente',
      } as unknown as CreateThirdPartyDto,
      userWith(BILLING),
    );

    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call).rejects.toThrow(
      'No tiene permiso para modificar el límite de crédito.',
    );
    expect($transaction).not.toHaveBeenCalled();
  });

  it('update permite creditLimit con customer.credit.update', async () => {
    await expect(
      service.update(
        'tp-1',
        { isCustomer: true, creditLimit: 500000 } as UpdateThirdPartyDto,
        userWith(ACCOUNTS),
      ),
    ).resolves.toBe('ok');
  });

  it('create permite creditLimit con customer.credit.update', async () => {
    await expect(
      service.create(
        {
          isCustomer: true,
          creditLimit: 500000,
          name: 'Cliente',
        } as unknown as CreateThirdPartyDto,
        userWith(ACCOUNTS),
      ),
    ).resolves.toBe('ok');
  });

  it('facturación sigue editando el cliente si no envía creditLimit', async () => {
    await expect(
      service.update(
        'tp-1',
        { isCustomer: true, discount: 5 } as UpdateThirdPartyDto,
        userWith(BILLING),
      ),
    ).resolves.toBe('ok');
  });
});

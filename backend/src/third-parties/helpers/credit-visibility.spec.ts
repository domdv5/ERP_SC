import { canSeeCustomerCredit, hideCreditLimit } from './credit-visibility';

describe('canSeeCustomerCredit', () => {
  it('quien puede hacer COT lo ve', () => {
    expect(canSeeCustomerCredit(['document.create.COT'])).toBe(true);
  });

  it('Cartera (fija cupos) lo ve', () => {
    expect(canSeeCustomerCredit(['customer.credit.update'])).toBe(true);
  });

  it('bodega, compras o preventa (solo thirdparty.read) no lo ven', () => {
    expect(canSeeCustomerCredit(['thirdparty.read'])).toBe(false);
  });
});

describe('hideCreditLimit', () => {
  const build = () => ({
    id: 'c1',
    customer: { id: 'c1', creditLimit: '500000' },
  });

  it('sin permiso de crédito deja el cupo en null', () => {
    expect(hideCreditLimit(build(), ['thirdparty.read']).customer).toEqual({
      id: 'c1',
      creditLimit: null,
    });
  });

  it('con document.create.COT conserva el cupo', () => {
    expect(
      hideCreditLimit(build(), ['document.create.COT']).customer?.creditLimit,
    ).toBe('500000');
  });

  it('con customer.credit.update conserva el cupo', () => {
    expect(
      hideCreditLimit(build(), ['customer.credit.update']).customer
        ?.creditLimit,
    ).toBe('500000');
  });

  it('un tercero sin cliente queda igual', () => {
    const supplierOnly = { id: 's1', customer: null };
    expect(hideCreditLimit(supplierOnly, [])).toEqual({
      id: 's1',
      customer: null,
    });
  });

  it('no modifica el objeto de entrada', () => {
    const input = build();
    hideCreditLimit(input, []);
    expect(input.customer.creditLimit).toBe('500000');
  });
});

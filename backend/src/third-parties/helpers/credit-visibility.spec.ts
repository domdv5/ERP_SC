import { canSeeCustomerCredit } from './credit-visibility';

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

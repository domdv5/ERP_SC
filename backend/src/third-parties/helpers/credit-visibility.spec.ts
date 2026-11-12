import { canSeeCustomerCredit } from './credit-visibility';

describe('canSeeCustomerCredit', () => {
  it('quien puede hacer COT lo ve con el filtro Clientes', () => {
    expect(canSeeCustomerCredit(['document.create.COT'], true)).toBe(true);
  });

  it('Cartera (fija cupos) lo ve con el filtro Clientes', () => {
    expect(canSeeCustomerCredit(['customer.credit.update'], true)).toBe(true);
  });

  it('bodega, compras o preventa (solo thirdparty.read) no lo ven', () => {
    expect(canSeeCustomerCredit(['thirdparty.read'], true)).toBe(false);
  });

  it('sin el filtro Clientes nadie lo recibe, ni con permiso', () => {
    const permissions = ['document.create.COT', 'customer.credit.update'];
    expect(canSeeCustomerCredit(permissions, undefined)).toBe(false);
    expect(canSeeCustomerCredit(permissions, false)).toBe(false);
  });
});

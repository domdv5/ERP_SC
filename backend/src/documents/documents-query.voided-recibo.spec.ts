import { DETAIL_INCLUDE } from './documents-query.service';

describe('Detalle de documento: saldos a favor de una DVV', () => {
  it('no lista aplicaciones de recibos de caja anulados', () => {
    expect(DETAIL_INCLUDE.customerCredits.include.applications).toMatchObject({
      where: {
        OR: [{ reciboCajaId: null }, { reciboCaja: { voidedAt: null } }],
      },
    });
  });
});

import { ROLE_PERMISSIONS } from '../../prisma/seeds/role-permissions.seed';

describe('ROLE_PERMISSIONS', () => {
  it('billing cannot create POSO (M2)', () => {
    expect(ROLE_PERMISSIONS.billing).not.toContain('document.create.POSO');
  });

  it('billing_lead has every billing permission plus POSO (M2)', () => {
    expect(ROLE_PERMISSIONS.billing_lead).toEqual([
      ...ROLE_PERMISSIONS.billing,
      'document.create.POSO',
    ]);
  });

  it('recibo.void es solo de admin y accounts_admin, igual que egreso.void', () => {
    const holders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, permissions]) => permissions.includes('recibo.void'))
      .map(([role]) => role);
    const egresoHolders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, permissions]) => permissions.includes('egreso.void'))
      .map(([role]) => role);

    expect(holders.sort()).toEqual(['accounts_admin', 'admin']);
    expect(holders.sort()).toEqual(egresoHolders.sort());
  });

  it('billing_lead cannot void POSO nor read the official book', () => {
    expect(ROLE_PERMISSIONS.billing_lead).not.toContain('document.void.POSO');
    expect(ROLE_PERMISSIONS.billing_lead).not.toContain('official.read');
  });
});

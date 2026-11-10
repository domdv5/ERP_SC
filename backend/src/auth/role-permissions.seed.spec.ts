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

  it('billing_lead cannot void POSO nor read the official book', () => {
    expect(ROLE_PERMISSIONS.billing_lead).not.toContain('document.void.POSO');
    expect(ROLE_PERMISSIONS.billing_lead).not.toContain('official.read');
  });
});

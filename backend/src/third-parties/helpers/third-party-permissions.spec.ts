import { missingThirdPartyRoles } from './third-party-permissions';

const BILLING = ['thirdparty.create', 'thirdparty.role.customer'];
const PURCHASING = [
  'thirdparty.role.customer',
  'thirdparty.role.supplier',
  'thirdparty.role.seller',
];

describe('missingThirdPartyRoles al crear (sin tercero actual)', () => {
  it('billing puede crear un cliente', () => {
    expect(missingThirdPartyRoles(BILLING, null, { isCustomer: true })).toEqual(
      [],
    );
  });

  it('billing no puede crear un proveedor ni un vendedor', () => {
    expect(
      missingThirdPartyRoles(BILLING, null, {
        isSupplier: true,
        isSeller: true,
      }),
    ).toEqual(['supplier', 'seller']);
  });

  it('billing no puede crear un cliente que además sea proveedor', () => {
    expect(
      missingThirdPartyRoles(BILLING, null, {
        isCustomer: true,
        isSupplier: true,
      }),
    ).toEqual(['supplier']);
  });

  it('una casilla en false no exige permiso', () => {
    expect(
      missingThirdPartyRoles(BILLING, null, {
        isCustomer: true,
        isSupplier: false,
      }),
    ).toEqual([]);
  });
});

describe('missingThirdPartyRoles al editar', () => {
  const customer = { isCustomer: true, isSupplier: false, isSeller: false };
  const supplier = { isCustomer: false, isSupplier: true, isSeller: false };
  const mixed = { isCustomer: true, isSupplier: true, isSeller: false };

  it('billing puede editar datos de un cliente puro', () => {
    expect(missingThirdPartyRoles(BILLING, customer, {})).toEqual([]);
  });

  it('billing no puede editar datos de un proveedor', () => {
    expect(missingThirdPartyRoles(BILLING, supplier, {})).toEqual(['supplier']);
  });

  it('billing no puede editar un tercero cliente y proveedor', () => {
    expect(missingThirdPartyRoles(BILLING, mixed, {})).toEqual(['supplier']);
  });

  it('billing no puede marcar como proveedor a un cliente', () => {
    expect(
      missingThirdPartyRoles(BILLING, customer, { isSupplier: true }),
    ).toEqual(['supplier']);
  });

  it('reenviar una casilla con el mismo valor no exige permiso extra', () => {
    expect(
      missingThirdPartyRoles(BILLING, customer, {
        isCustomer: true,
        isSupplier: false,
        isSeller: false,
      }),
    ).toEqual([]);
  });

  it('compras puede editar y cambiar cualquier tipo', () => {
    expect(
      missingThirdPartyRoles(PURCHASING, mixed, {
        isSupplier: false,
        isSeller: true,
      }),
    ).toEqual([]);
  });
});

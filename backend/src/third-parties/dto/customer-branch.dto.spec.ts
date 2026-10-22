import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerBranchDto } from './customer-branch.dto';
import { UpdateCustomerBranchDto } from './update-customer-branch.dto';
import { UpdateThirdPartyDto } from './update-third-party.dto';

describe('UpdateCustomerBranchDto', () => {
  it("convierte '' en null en address y phone y valida", async () => {
    const dto = plainToInstance(UpdateCustomerBranchDto, {
      address: '',
      phone: '',
    });

    expect(dto.address).toBeNull();
    expect(dto.phone).toBeNull();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('deja undefined los campos omitidos', async () => {
    const dto = plainToInstance(UpdateCustomerBranchDto, { name: 'Norte' });

    expect(dto.address).toBeUndefined();
    expect(dto.phone).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('conserva valores con texto', () => {
    const dto = plainToInstance(UpdateCustomerBranchDto, {
      address: 'Calle 1',
      phone: '300',
    });

    expect(dto.address).toBe('Calle 1');
    expect(dto.phone).toBe('300');
  });
});

describe('CustomerBranchDto (crear)', () => {
  it("sigue convirtiendo '' en undefined", () => {
    const dto = plainToInstance(CustomerBranchDto, {
      name: 'Norte',
      address: '',
      phone: '',
    });

    expect(dto.address).toBeUndefined();
    expect(dto.phone).toBeUndefined();
  });
});

describe('cityCode (tercero y sucursal)', () => {
  it.each([CustomerBranchDto, UpdateCustomerBranchDto, UpdateThirdPartyDto])(
    "%p: '' se guarda como null (sin ciudad)",
    async (Dto) => {
      const dto = plainToInstance(Dto, { name: 'Norte', cityCode: '' });

      expect(dto.cityCode).toBeNull();
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each([CustomerBranchDto, UpdateCustomerBranchDto, UpdateThirdPartyDto])(
    '%p: acepta un código DANE de 5 dígitos',
    async (Dto) => {
      const dto = plainToInstance(Dto, { name: 'Norte', cityCode: '05001' });

      expect(dto.cityCode).toBe('05001');
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each([CustomerBranchDto, UpdateCustomerBranchDto, UpdateThirdPartyDto])(
    '%p: rechaza un código mal formado',
    async (Dto) => {
      const dto = plainToInstance(Dto, { name: 'Norte', cityCode: '5001' });
      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['cityCode']);
      expect(errors[0].constraints).toEqual({
        matches: 'La ciudad no es válida',
      });
    },
  );
});

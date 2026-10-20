import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerBranchDto } from './customer-branch.dto';
import { UpdateCustomerBranchDto } from './update-customer-branch.dto';

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

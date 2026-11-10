import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAuthDto } from '../auth/dto/create-auth.dto';
import { UpdateAuthDto } from '../auth/dto/update-auth.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';

// Ids nuevos de Prisma son uuid(7); los viejos son v4
const UUID_V7 = '01a1c66a-069e-735e-bbea-791eed3800db';
const UUID_V4 = '9a323c2b-9c9c-4891-9d86-0cb88fdb3385';

async function findErrorFields(dtoClass: new () => object, body: object) {
  const errors = await validate(plainToInstance(dtoClass, body));
  return errors.map((error) => error.property);
}

describe('DTOs accept uuid v7 ids', () => {
  it.each([UUID_V4, UUID_V7])(
    'CreateAuthDto accepts roleIds %s',
    async (id) => {
      const fields = await findErrorFields(CreateAuthDto, { roleIds: [id] });
      expect(fields).not.toContain('roleIds');
    },
  );

  it.each([UUID_V4, UUID_V7])(
    'UpdateAuthDto accepts roleIds %s',
    async (id) => {
      const fields = await findErrorFields(UpdateAuthDto, { roleIds: [id] });
      expect(fields).not.toContain('roleIds');
    },
  );

  it('CreateAuthDto still rejects roleIds that are not uuids', async () => {
    const fields = await findErrorFields(CreateAuthDto, {
      roleIds: ['not-a-uuid'],
    });
    expect(fields).toContain('roleIds');
  });

  it.each([UUID_V4, UUID_V7])(
    'CreateProductDto accepts brandId, genderId and categoryId %s',
    async (id) => {
      const fields = await findErrorFields(CreateProductDto, {
        brandId: id,
        genderId: id,
        categoryId: id,
      });
      expect(fields).not.toContain('brandId');
      expect(fields).not.toContain('genderId');
      expect(fields).not.toContain('categoryId');
    },
  );

  it('CreateProductDto still rejects a brandId that is not a uuid', async () => {
    const fields = await findErrorFields(CreateProductDto, {
      brandId: 'not-a-uuid',
    });
    expect(fields).toContain('brandId');
  });
});

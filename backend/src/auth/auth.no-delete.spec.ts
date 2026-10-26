import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('Usuarios: no se eliminan, se desactivan', () => {
  it('el controller no expone ninguna ruta DELETE', () => {
    const methods = Object.getOwnPropertyNames(AuthController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        Reflect.getMetadata(
          METHOD_METADATA,
          AuthController.prototype[name as keyof AuthController],
        ),
      );

    expect(methods).not.toContain(RequestMethod.DELETE);
  });

  it('el service no tiene método para borrar usuarios', () => {
    expect(AuthService.prototype).not.toHaveProperty('remove');
  });
});

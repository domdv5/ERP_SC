import { IsNotEmpty, IsString } from 'class-validator';

// Sin largo mínimo: hay contraseñas creadas antes de exigirlo y tienen que poder entrar.
export class LoginAuthDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

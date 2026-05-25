import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateAuthDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  password!: string;

  @IsNotEmpty()
  @IsUUID()
  roleId!: string;

  active: boolean = true;
}

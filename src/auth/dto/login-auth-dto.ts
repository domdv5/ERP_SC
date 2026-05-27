import { OmitType } from '@nestjs/mapped-types';
import { CreateAuthDto } from '@/auth/dto/create-auth.dto';

export class LoginAuthDto extends OmitType(CreateAuthDto, [
  'name',
  'roleId',
] as const) {}

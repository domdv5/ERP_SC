import { OmitType } from '@nestjs/mapped-types';
import { CreateAuthDto } from './create-auth.dto';

export class LoginAuthDto extends OmitType(CreateAuthDto, [
  'name',
  'roleIds',
] as const) {}

import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../password-rule';

export class CreateAuthDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  password!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @IsOptional()
  @IsBoolean()
  active: boolean = true;
}

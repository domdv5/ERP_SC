import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from '../password-rule';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}

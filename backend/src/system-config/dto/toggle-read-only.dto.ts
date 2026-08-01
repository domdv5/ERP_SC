import { IsBoolean } from 'class-validator';

export class ToggleReadOnlyDto {
  @IsBoolean()
  active!: boolean;
}

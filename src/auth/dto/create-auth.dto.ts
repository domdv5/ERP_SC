import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAuthDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsNotEmpty()
  password!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  roleIds!: string[];

  @IsOptional()
  @IsBoolean()
  active: boolean = true;
}

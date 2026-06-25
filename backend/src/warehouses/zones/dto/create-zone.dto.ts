import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

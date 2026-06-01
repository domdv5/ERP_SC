import { PartialType } from '@nestjs/mapped-types';
import { CreateThirdPartyDto } from './create-third-party.dto';

export class UpdateThirdPartyDto extends PartialType(CreateThirdPartyDto) {}

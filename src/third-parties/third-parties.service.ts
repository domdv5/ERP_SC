import { Injectable } from '@nestjs/common';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ThirdPartiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateThirdPartyDto) {
    return this.prisma.thirdParty.create({ data: dto });
  }
}

import { Injectable } from '@nestjs/common';
import { CreateThirdPartyDto } from './dto/create-third-party.dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ThirdPartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createThirdPartyDto: CreateThirdPartyDto) {
    const {
      isCustomer,
      isSupplier,
      creditLimit,
      discount,
      sellerId,
      internalNumber,
      ...thirdPartyData
    } = createThirdPartyDto;

    return this.prisma.$transaction(async (tx) => {
      const thirdParty = await tx.thirdParty.create({ data: thirdPartyData });

      if (isCustomer) {
        await tx.customer.create({
          data: { id: thirdParty.id, creditLimit, discount, sellerId },
        });
      }

      if (isSupplier) {
        await tx.supplier.create({
          data: { id: thirdParty.id, internalNumber },
        });
      }

      return tx.thirdParty.findUnique({
        where: { id: thirdParty.id },
        include: { customer: true, supplier: true },
      });
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Customer, Supplier } from '@prisma/client';
import {
  CreateThirdPartyDto,
  UpdateThirdPartyDto,
} from '@/third-parties/dto/index';
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

      let customer: Customer | null = null;
      let supplier: Supplier | null = null;

      if (isCustomer) {
        customer = await tx.customer.create({
          data: { id: thirdParty.id, creditLimit, discount, sellerId },
        });
      }

      if (isSupplier) {
        supplier = await tx.supplier.create({
          data: { id: thirdParty.id, internalNumber },
        });
      }

      return { ...thirdParty, customer, supplier };
    });
  }

  async update(id: string, updateThirdPartyDto: UpdateThirdPartyDto) {
    const {
      isCustomer,
      isSupplier,
      creditLimit,
      discount,
      sellerId,
      internalNumber,
      ...thirdPartyData
    } = updateThirdPartyDto;

    return await this.prisma.thirdParty.update({
      where: { id },
      data: {
        ...thirdPartyData,
        customer: isCustomer
          ? {
              update: { creditLimit, discount, sellerId },
            }
          : undefined,
        supplier: isSupplier
          ? {
              update: { internalNumber },
            }
          : undefined,
      },
    });
  }
}

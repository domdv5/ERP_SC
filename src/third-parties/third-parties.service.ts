import { Injectable } from '@nestjs/common';
import { Customer, Prisma, Supplier } from '@prisma/client';
import {
  CreateThirdPartyDto,
  FindAllThirdPartiesDto,
  UpdateThirdPartyDto,
} from '@/third-parties/dto/index';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ThirdPartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findAllThirdPartiesDto: FindAllThirdPartiesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      isCustomer,
      isSupplier,
      isActive,
    } = findAllThirdPartiesDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ThirdPartyWhereInput = {
      isActive: isActive !== undefined ? isActive : true,
      ...(isCustomer !== undefined && { isCustomer }),
      ...(isSupplier !== undefined && { isSupplier }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.thirdParty.findMany({
        where,
        include: {
          customer: true,
          supplier: { include: { brands: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.thirdParty.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(createThirdPartyDto: CreateThirdPartyDto) {
    const {
      isCustomer,
      isSupplier,
      creditLimit,
      discount,
      sellerId,
      internalNumber,
      brands,
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
          data: {
            id: thirdParty.id,
            internalNumber,
            brands: {
              createMany: {
                data: brands.map((name: string) => ({ name })),
              },
            },
          },
        });
      }

      return { ...thirdParty, customer, supplier };
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.thirdParty.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedById: userId,
      },
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

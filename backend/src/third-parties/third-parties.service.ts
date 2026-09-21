import { BadRequestException, Injectable } from '@nestjs/common';
import { Customer, Prisma, Supplier } from '@prisma/client';
import {
  CreateThirdPartyDto,
  FindAllThirdPartiesDto,
  UpdateThirdPartyDto,
} from './dto/index';
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
      isSeller,
      isActive,
    } = findAllThirdPartiesDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ThirdPartyWhereInput = {
      isActive: isActive !== undefined ? isActive : true,
      ...(isCustomer !== undefined && { isCustomer }),
      ...(isSupplier !== undefined && { isSupplier }),
      ...(isSeller !== undefined && { isSeller }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { documentNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total, customerCount, supplierCount] =
      await this.prisma.$transaction([
        this.prisma.thirdParty.findMany({
          where,
          include: {
            customer: true,
            supplier: { include: { brands: { where: { active: true } } } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.thirdParty.count({ where }),
        this.prisma.thirdParty.count({ where: { ...where, isCustomer: true } }),
        this.prisma.thirdParty.count({ where: { ...where, isSupplier: true } }),
      ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        customerCount,
        supplierCount,
      },
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
      discountNotes,
      ...thirdPartyData
    } = createThirdPartyDto;

    if (!isCustomer && !isSupplier && !thirdPartyData.isSeller) {
      throw new BadRequestException(
        'El tercero debe tener al menos un rol: cliente, proveedor o vendedor.',
      );
    }

    if (
      thirdPartyData.personType === 'juridica' &&
      thirdPartyData.documentType !== 'NIT'
    ) {
      throw new BadRequestException(
        'Una persona jurídica debe usar NIT como tipo de documento.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const thirdParty = await tx.thirdParty.create({
        data: {
          ...thirdPartyData,
          isCustomer: !!isCustomer,
          isSupplier: !!isSupplier,
        },
      });

      let customer: Customer | null = null;
      let supplier: Supplier | null = null;

      if (isCustomer) {
        customer = await tx.customer.create({
          data: { id: thirdParty.id, creditLimit, discount, sellerId },
        });
      }

      if (isSupplier) {
        // Los brands nunca se borran (los productos los referencian por id);
        // solo se crean o se renombran vía renameBrand().
        supplier = await tx.supplier.create({
          data: {
            id: thirdParty.id,
            internalNumber,
            discountNotes,
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

  renameBrand(supplierId: string, brandId: string, name: string) {
    return this.prisma.brand.update({
      where: { id: brandId, supplierId },
      data: { name },
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

  reactivate(id: string) {
    return this.prisma.thirdParty.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
        deletedById: null,
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
      brands,
      discountNotes,
      ...thirdPartyData
    } = updateThirdPartyDto;

    return this.prisma.$transaction(async (tx) => {
      // La relación de proveedor tiene que existir antes de que las marcas puedan
      // apuntar a ella, así que el upsert de abajo va antes de crear las marcas.
      const updated = await tx.thirdParty.update({
        where: { id },
        data: {
          ...thirdPartyData,
          ...(isCustomer !== undefined && { isCustomer }),
          ...(isSupplier !== undefined && { isSupplier }),
          customer: isCustomer
            ? {
                upsert: {
                  create: { creditLimit, discount, sellerId },
                  update: { creditLimit, discount, sellerId },
                },
              }
            : undefined,
          // upsert solo si viene internalNumber (obligatorio para crear); si el PATCH solo toca discountNotes, es un update plano.
          supplier: isSupplier
            ? internalNumber !== undefined
              ? {
                  upsert: {
                    create: { internalNumber, discountNotes },
                    update: { internalNumber, discountNotes },
                  },
                }
              : discountNotes !== undefined
                ? { update: { discountNotes } }
                : undefined
            : undefined,
        },
      });

      // Valida sobre el estado ya mergeado, pero solo si el PATCH tocó isCustomer/isSupplier/isSeller — no bloquea legacy sin roles en ediciones no relacionadas.
      const rolesTouched =
        isCustomer !== undefined ||
        isSupplier !== undefined ||
        updateThirdPartyDto.isSeller !== undefined;
      if (
        rolesTouched &&
        !updated.isCustomer &&
        !updated.isSupplier &&
        !updated.isSeller
      ) {
        throw new BadRequestException(
          'El tercero debe tener al menos un rol: cliente, proveedor o vendedor.',
        );
      }

      const documentTypeTouched =
        updateThirdPartyDto.personType !== undefined ||
        updateThirdPartyDto.documentType !== undefined;
      if (
        documentTypeTouched &&
        updated.personType === 'juridica' &&
        updated.documentType !== 'NIT'
      ) {
        throw new BadRequestException(
          'Una persona jurídica debe usar NIT como tipo de documento.',
        );
      }

      if (isSupplier && brands !== undefined) {
        // Los brands nunca se eliminan, solo se agregan o renombran; skipDuplicates protege contra nombre duplicado.
        await tx.brand.createMany({
          data: brands.map((name) => ({ name, supplierId: id })),
          skipDuplicates: true,
        });
      }

      return tx.thirdParty.findUniqueOrThrow({
        where: { id },
        include: { customer: true, supplier: { include: { brands: true } } },
      });
    });
  }
}

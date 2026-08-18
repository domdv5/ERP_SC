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

    if (thirdPartyData.personType === 'juridica' && thirdPartyData.documentType !== 'NIT') {
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
      // The supplier relation must exist before brands can reference it via
      // supplierId, so the upsert below has to run before brand.createMany.
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
          // internalNumber es obligatorio para crear un Supplier nuevo, así que
          // solo se puede hacer upsert (create-o-update) cuando viene en el
          // payload. Si el PATCH manda únicamente discountNotes (sin tocar
          // internalNumber), se usa un update plano en vez de upsert — asume
          // que el Supplier ya existe; si no existe, Prisma lanza P2025 y lo
          // traduce el PrismaExceptionFilter global.
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

      // isCustomer/isSupplier/isSeller pueden venir omitidos en el payload
      // (PartialType no los fuerza a false), así que la validación corre sobre
      // el estado ya mergeado por Prisma, no sobre el DTO recibido. Pero solo
      // se exige el invariante si el PATCH tocó alguno de esos campos — así un
      // registro legacy que ya lo incumplía no bloquea ediciones de campos no
      // relacionados (ej. actualizar el teléfono), solo bloquea intentos de
      // dejarlo sin roles.
      const rolesTouched =
        isCustomer !== undefined ||
        isSupplier !== undefined ||
        updateThirdPartyDto.isSeller !== undefined;
      if (rolesTouched && !updated.isCustomer && !updated.isSupplier && !updated.isSeller) {
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
        // El frontend solo envía brands nuevos (no los ya existentes en
        // brandIds), pero skipDuplicates igual protege contra el nombre
        // duplicado — los brands nunca se eliminan, solo se agregan o renombran.
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

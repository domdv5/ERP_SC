import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Customer, Prisma, Supplier } from '@prisma/client';
import {
  CreateThirdPartyDto,
  FindAllThirdPartiesDto,
  UpdateCustomerBranchDto,
  UpdateThirdPartyDto,
} from './dto/index';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import {
  missingThirdPartyRoles,
  ThirdPartyRole,
  ThirdPartyRoleFlags,
} from './helpers/third-party-permissions';

const ROLE_LABELS: Record<ThirdPartyRole, string> = {
  customer: 'cliente',
  supplier: 'proveedor',
  seller: 'vendedor',
  receiver: 'recibe mercancía',
};

const CITY_INCLUDE = {
  city: { include: { department: true } },
} satisfies Prisma.ThirdPartyInclude;

const ACTIVE_BRANCHES_INCLUDE = {
  branches: {
    where: { active: true },
    orderBy: { name: 'asc' },
    include: CITY_INCLUDE,
  },
} satisfies Prisma.CustomerInclude;

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
      isReceiver,
      isActive,
    } = findAllThirdPartiesDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ThirdPartyWhereInput = {
      isActive: isActive !== undefined ? isActive : true,
      ...(isCustomer !== undefined && { isCustomer }),
      ...(isSupplier !== undefined && { isSupplier }),
      ...(isSeller !== undefined && { isSeller }),
      ...(isReceiver !== undefined && { isReceiver }),
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
            ...CITY_INCLUDE,
            customer: { include: ACTIVE_BRANCHES_INCLUDE },
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

  async findOne(id: string) {
    const thirdParty = await this.prisma.thirdParty.findUnique({
      where: { id },
      include: {
        ...CITY_INCLUDE,
        customer: { include: ACTIVE_BRANCHES_INCLUDE },
        supplier: { include: { brands: { where: { active: true } } } },
      },
    });
    if (!thirdParty) {
      throw new NotFoundException('Tercero no encontrado.');
    }
    return thirdParty;
  }

  async create(createThirdPartyDto: CreateThirdPartyDto, user: JwtPayload) {
    this.assertRolePermissions(user, null, createThirdPartyDto, 'registrar');

    const {
      isCustomer,
      isSupplier,
      creditLimit,
      discount,
      sellerId,
      internalNumber,
      brands,
      branches,
      discountNotes,
      ...thirdPartyData
    } = createThirdPartyDto;

    if (
      !isCustomer &&
      !isSupplier &&
      !thirdPartyData.isSeller &&
      !thirdPartyData.isReceiver
    ) {
      throw new BadRequestException(
        'El tercero debe tener al menos un rol: cliente, proveedor, vendedor o recibe mercancía.',
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
        // Las sucursales nunca se borran (los documentos las referencian por id);
        // solo se crean o se editan vía updateBranch().
        customer = await tx.customer.create({
          data: {
            id: thirdParty.id,
            creditLimit,
            discount,
            sellerId,
            ...(branches?.length && {
              branches: { createMany: { data: branches } },
            }),
          },
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

  async renameBrand(
    supplierId: string,
    brandId: string,
    name: string,
    user: JwtPayload,
  ) {
    await this.assertCanEdit(supplierId, {}, user);

    return this.prisma.brand.update({
      where: { id: brandId, supplierId },
      data: { name },
    });
  }

  async updateBranch(
    customerId: string,
    branchId: string,
    dto: UpdateCustomerBranchDto,
    user: JwtPayload,
  ) {
    await this.assertCanEdit(customerId, {}, user);

    return this.prisma.customerBranch.update({
      where: { id: branchId, customerId },
      data: dto,
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

  async update(
    id: string,
    updateThirdPartyDto: UpdateThirdPartyDto,
    user: JwtPayload,
  ) {
    await this.assertCanEdit(id, updateThirdPartyDto, user);

    const {
      isCustomer,
      isSupplier,
      creditLimit,
      discount,
      sellerId,
      internalNumber,
      brands,
      branches,
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

      // Valida sobre el estado ya mergeado, pero solo si el PATCH tocó isCustomer/isSupplier/isSeller/isReceiver — no bloquea legacy sin roles en ediciones no relacionadas.
      const rolesTouched =
        isCustomer !== undefined ||
        isSupplier !== undefined ||
        updateThirdPartyDto.isSeller !== undefined ||
        updateThirdPartyDto.isReceiver !== undefined;
      if (
        rolesTouched &&
        !updated.isCustomer &&
        !updated.isSupplier &&
        !updated.isSeller &&
        !updated.isReceiver
      ) {
        throw new BadRequestException(
          'El tercero debe tener al menos un rol: cliente, proveedor, vendedor o recibe mercancía.',
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

      if (isCustomer && branches !== undefined) {
        // Las sucursales nunca se eliminan, solo se agregan o editan; skipDuplicates protege contra nombre duplicado.
        await tx.customerBranch.createMany({
          data: branches.map((branch) => ({ ...branch, customerId: id })),
          skipDuplicates: true,
        });
      }

      return tx.thirdParty.findUniqueOrThrow({
        where: { id },
        include: {
          ...CITY_INCLUDE,
          customer: { include: ACTIVE_BRANCHES_INCLUDE },
          supplier: { include: { brands: true } },
        },
      });
    });
  }

  private assertRolePermissions(
    user: JwtPayload,
    current: ThirdPartyRoleFlags | null,
    change: ThirdPartyRoleFlags,
    verb: 'registrar' | 'editar',
  ) {
    const missing = missingThirdPartyRoles(user.permissions, current, change);
    if (missing.length > 0) {
      throw new ForbiddenException(
        `No tiene permiso para ${verb} terceros de tipo ${missing.map((role) => ROLE_LABELS[role]).join(', ')}`,
      );
    }
  }

  private async assertCanEdit(
    id: string,
    change: ThirdPartyRoleFlags,
    user: JwtPayload,
  ) {
    const current = await this.prisma.thirdParty.findUnique({
      where: { id },
      select: {
        isCustomer: true,
        isSupplier: true,
        isSeller: true,
        isReceiver: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Tercero no encontrado.');
    }
    this.assertRolePermissions(user, current, change, 'editar');
  }
}

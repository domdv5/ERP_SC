import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateProductDto,
  FindAllProductsDto,
  UpdateProductDto,
} from './dto/index';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(findAllProductsDto: FindAllProductsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      active,
      categoryId,
      brandId,
      genderId,
    } = findAllProductsDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(active !== undefined && { active }),
      ...(categoryId && { categoryId }),
      ...(brandId && { brandId }),
      ...(genderId && { genderId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total, activeCount, inStockCount, activeWarehouses] =
      await this.prisma.$transaction([
        this.prisma.product.findMany({
          where,
          include: {
            brand: true,
            gender: true,
            category: true,
            inventoryRecords: { select: { warehouseId: true, quantity: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where }),
        this.prisma.product.count({ where: { ...where, active: true } }),
        this.prisma.product.count({
          where: {
            ...where,
            inventoryRecords: { some: { quantity: { gt: 0 } } },
          },
        }),
        this.prisma.warehouse.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);

    return {
      items: items.map((item) => {
        const { inventoryRecords, ...rest } = item;
        return {
          ...rest,
          ...this.buildStockBreakdown(inventoryRecords, activeWarehouses),
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        activeCount,
        inStockCount,
      },
    };
  }

  private buildStockBreakdown(
    inventoryRecords: { warehouseId: string; quantity: number }[],
    warehouses: { id: string; name: string }[],
  ) {
    const stockByWarehouse = warehouses.map((w) => ({
      warehouseId: w.id,
      warehouseName: w.name,
      quantity:
        inventoryRecords.find((r) => r.warehouseId === w.id)?.quantity ?? 0,
    }));

    const totalStock = stockByWarehouse.reduce(
      (sum, s) => sum + s.quantity,
      0,
    );

    return { stockByWarehouse, totalStock };
  }

  create(createProductDto: CreateProductDto) {
    return this.prisma.product.create({ data: { ...createProductDto } });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { brand: true, gender: true, category: true },
    });
  }

  update(id: string, updateProductDto: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: { ...updateProductDto },
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.product.update({
      where: { id },
      data: {
        active: false,
        deletedAt: new Date(),
        deletedById: userId,
      },
    });
  }

  getBrands() {
    return this.prisma.brand.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { supplier: { select: { internalNumber: true } } },
    });
  }

  getGenders() {
    return this.prisma.gender.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  getCategories() {
    return this.prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }
}

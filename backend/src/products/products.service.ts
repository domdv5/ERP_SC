import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateProductDto,
  FindAllProductsDto,
  UpdateProductDto,
} from './dto/index';
import { PrismaService } from '@/prisma/prisma.service';
import { getReservedByProduct } from '@/documents/helpers/reservation.helpers';

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

    // Fuera de la $transaction principal a propósito: necesita los productId
    // de la página ya resuelta, y no hace falta que corra en la misma
    // transacción serializada (reservedQuantity es una lectura derivada, no
    // afecta ninguna invariante de escritura como BinStock/Inventory).
    const reservedByProduct = await getReservedByProduct(
      this.prisma,
      items.map((item) => item.id),
    );

    return {
      items: items.map((item) => {
        const { inventoryRecords, ...rest } = item;
        const stockBreakdown = this.buildStockBreakdown(
          inventoryRecords,
          activeWarehouses,
        );
        const reservedQuantity = reservedByProduct.get(item.id) ?? 0;

        return {
          ...rest,
          ...stockBreakdown,
          reservedQuantity,
          availableStock: stockBreakdown.totalStock - reservedQuantity,
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

    const totalStock = stockByWarehouse.reduce((sum, s) => sum + s.quantity, 0);

    return { stockByWarehouse, totalStock };
  }

  async findByCode(code: string) {
    const product = await this.prisma.product.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      include: { brand: true, gender: true, category: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async findLocationsByCode(code: string) {
    const product = await this.prisma.product.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      include: { brand: true },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const {
      id,
      code: productCode,
      description,
      brand: { id: brandId, name },
      active,
      unitOfMeasure,
    } = product;

    const [binStocks, inventoryRecords] = await this.prisma.$transaction([
      this.prisma.binStock.findMany({
        where: { productId: product.id, quantity: { gt: 0 } },
        include: { bin: { include: { zone: true } }, warehouse: true },
        orderBy: [{ warehouse: { name: 'asc' } }],
      }),
      this.prisma.inventory.findMany({
        where: { productId: product.id },
        include: { warehouse: { select: { id: true, name: true } } },
      }),
    ]);

    const locations = binStocks.map((loacation) => ({
      warehouseId: loacation.warehouseId,
      warehouseName: loacation.warehouse.name,
      zoneName: loacation.bin.zone.name,
      binCode: loacation.bin.code,
      quantity: loacation.quantity,
    }));

    const warehouseTotals = inventoryRecords.map((inventory) => ({
      warehouseId: inventory.warehouseId,
      warehouseName: inventory.warehouse.name,
      quantity: inventory.quantity,
    }));

    const totalBinQuantity = binStocks.reduce((acc, item) => {
      return acc + item.quantity;
    }, 0);

    const totalWarehousesQuantity = inventoryRecords.reduce((acc, item) => {
      return acc + item.quantity;
    }, 0);

    // BinStock solo se llena por traslados (T); las compras (CM) entran solo a
    // Inventory sin bin. Por eso totalBinQuantity puede quedar por debajo del
    // total de Inventory — eso no es "sin stock", es "stock sin bulto asignado".
    return {
      product: {
        id,
        code: productCode,
        description,
        brand: { id: brandId, name },
        active,
        unitOfMeasure,
      },
      locations,
      warehouseTotals,
      totalBinQuantity,
      hasUnassignedStock: totalWarehousesQuantity > totalBinQuantity,
    };
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateProductDto,
  FindAllProductsDto,
  UpdateProductDto,
} from './dto/index';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentType } from '@/common/enums';
import { getReservedByProduct } from '@/documents/helpers/reservation.helpers';
import { matchContract } from '@/common/types';
import type {
  BrandOption,
  Gender,
  ProductCategory,
  ProductByCode,
  ProductDetail,
  ProductListResponse,
  ProductLocationsResult,
  ProductRecord,
} from '@/contracts';

const matchListContract = matchContract<ProductListResponse>();
const matchByCodeContract = matchContract<ProductByCode>();
const matchOptionalDetailContract = matchContract<ProductDetail | null>();
const matchLocationsContract = matchContract<ProductLocationsResult>();
const matchRecordContract = matchContract<ProductRecord>();
const matchBrandsContract = matchContract<BrandOption[]>();
const matchGendersContract = matchContract<Gender[]>();
const matchCategoriesContract = matchContract<ProductCategory[]>();

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
      supplierId,
    } = findAllProductsDto;
    const skip = (page - 1) * limit;

    // supplierId manda sobre brandId: filtra por las marcas activas de ese proveedor.
    const brandFilter = supplierId
      ? {
          brandId: {
            in: (
              await this.prisma.brand.findMany({
                where: { supplierId, active: true },
                select: { id: true },
              })
            ).map((b) => b.id),
          },
        }
      : brandId
        ? { brandId }
        : {};

    const where: Prisma.ProductWhereInput = {
      active: active !== undefined ? active : true,
      ...(categoryId && { categoryId }),
      ...brandFilter,
      ...(genderId && { genderId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { legacyCode: { contains: search, mode: 'insensitive' } },
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
          select: { id: true, name: true, type: true },
          orderBy: { name: 'asc' },
        }),
      ]);

    // Fuera de la transacción principal: necesita los ids de la página ya resuelta. PV y REM se cuentan aparte para columnas distintas.
    const productIds = items.map((item) => item.id);
    const [reservedByProduct, remisionByProduct] = await Promise.all([
      getReservedByProduct(this.prisma, productIds, {
        types: [DocumentType.PV],
      }),
      getReservedByProduct(this.prisma, productIds, {
        types: [DocumentType.REM],
      }),
    ]);

    return matchListContract({
      items: items.map((item) => {
        const { inventoryRecords, ...rest } = item;
        const stockBreakdown = this.buildStockBreakdown(
          inventoryRecords,
          activeWarehouses,
        );
        const reservedQuantity = reservedByProduct.get(item.id) ?? 0;
        const remisionQuantity = remisionByProduct.get(item.id) ?? 0;

        return {
          ...rest,
          ...stockBreakdown,
          reservedQuantity,
          remisionQuantity,
          availableStock: this.calculateAvailableStock(
            stockBreakdown.totalStock,
            reservedQuantity,
            remisionQuantity,
          ),
          availableToSell: this.calculateAvailableStock(
            this.calculateStoreStock(inventoryRecords, activeWarehouses),
            reservedQuantity,
            remisionQuantity,
          ),
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
    });
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

  // Solo la tienda vende: lo de la bodega cuenta recién después del traslado
  private calculateStoreStock(
    inventoryRecords: { warehouseId: string; quantity: number }[],
    warehouses: { id: string; type: string }[],
  ) {
    const storeIds = new Set(
      warehouses.filter((w) => w.type === 'store').map((w) => w.id),
    );
    return inventoryRecords
      .filter((r) => storeIds.has(r.warehouseId))
      .reduce((sum, r) => sum + r.quantity, 0);
  }

  // Puede ser negativo (ajuste de salida sobre stock reservado)
  private calculateAvailableStock(
    totalStock: number,
    reservedQuantity: number,
    remisionQuantity: number,
  ) {
    return totalStock - reservedQuantity - remisionQuantity;
  }

  async findByCode(code: string) {
    const product = await this.prisma.product.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      include: {
        brand: true,
        gender: true,
        category: true,
        inventoryRecords: { select: { warehouseId: true, quantity: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const [activeWarehouses, reservedByProduct, remisionByProduct] =
      await Promise.all([
        this.prisma.warehouse.findMany({
          where: { active: true },
          select: { id: true, name: true, type: true },
          orderBy: { name: 'asc' },
        }),
        getReservedByProduct(this.prisma, [product.id], {
          types: [DocumentType.PV],
        }),
        getReservedByProduct(this.prisma, [product.id], {
          types: [DocumentType.REM],
        }),
      ]);

    const { inventoryRecords, ...rest } = product;
    const { totalStock } = this.buildStockBreakdown(
      inventoryRecords,
      activeWarehouses,
    );

    const reservedQuantity = reservedByProduct.get(product.id) ?? 0;
    const remisionQuantity = remisionByProduct.get(product.id) ?? 0;

    return matchByCodeContract({
      ...rest,
      availableStock: this.calculateAvailableStock(
        totalStock,
        reservedQuantity,
        remisionQuantity,
      ),
      availableToSell: this.calculateAvailableStock(
        this.calculateStoreStock(inventoryRecords, activeWarehouses),
        reservedQuantity,
        remisionQuantity,
      ),
    });
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

    // Solo los traslados llenan el stock por bulto; el total en bultos puede ser menor al de la bodega (stock sin bulto asignado, no sin stock).
    return matchLocationsContract({
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
    });
  }

  async create(createProductDto: CreateProductDto) {
    return matchRecordContract(
      await this.prisma.product.create({ data: { ...createProductDto } }),
    );
  }

  async findOne(id: string) {
    return matchOptionalDetailContract(
      await this.prisma.product.findUnique({
        where: { id },
        include: { brand: true, gender: true, category: true },
      }),
    );
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    return matchRecordContract(
      await this.prisma.product.update({
        where: { id },
        data: { ...updateProductDto },
      }),
    );
  }

  async remove(id: string, userId: string) {
    return matchRecordContract(
      await this.prisma.product.update({
        where: { id },
        data: {
          active: false,
          deletedAt: new Date(),
          deletedById: userId,
        },
      }),
    );
  }

  async reactivate(id: string) {
    return matchRecordContract(
      await this.prisma.product.update({
        where: { id },
        data: {
          active: true,
          deletedAt: null,
          deletedById: null,
        },
      }),
    );
  }

  async getBrands() {
    return matchBrandsContract(
      await this.prisma.brand.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: { supplier: { select: { internalNumber: true } } },
      }),
    );
  }

  async getGenders() {
    return matchGendersContract(
      await this.prisma.gender.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async getCategories() {
    return matchCategoriesContract(
      await this.prisma.category.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),
    );
  }
}

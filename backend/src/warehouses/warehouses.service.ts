import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/index';

type BinWithStocks = Prisma.BinGetPayload<{
  include: { binStocks: { select: { productId: true; quantity: true } } };
}>;

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.warehouse.findMany({
      where: { active: true },
      include: { _count: { select: { zones: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          include: {
            bins: {
              include: {
                binStocks: { select: { productId: true, quantity: true } },
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      return warehouse;
    }

    return {
      ...warehouse,
      zones: warehouse.zones.map((zone) => ({
        ...zone,
        bins: zone.bins.map((bin) => this.buildBinOccupancy(bin)),
      })),
    };
  }

  private buildBinOccupancy(bin: BinWithStocks) {
    const { binStocks, ...rest } = bin;
    const stockDetail = binStocks
      .filter((s) => s.quantity > 0)
      .map((s) => ({ productId: s.productId, quantity: s.quantity }));
    // `occupied` no se persiste: se deriva en vivo de BinStock para que nunca
    // quede desincronizado (un bin queda libre automáticamente al vaciarse).
    const occupied = stockDetail.length > 0;

    return { ...rest, occupied, binStocks: stockDetail };
  }

  create(createWarehouseDto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: createWarehouseDto });
  }

  update(id: string, updateWarehouseDto: UpdateWarehouseDto) {
    return this.prisma.warehouse.update({
      where: { id },
      data: updateWarehouseDto,
    });
  }

  remove(id: string) {
    return this.prisma.warehouse.update({
      where: { id },
      data: { active: false },
    });
  }
}

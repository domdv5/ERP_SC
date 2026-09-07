import { BadRequestException, Injectable } from '@nestjs/common';
import { WarehouseType } from '@prisma/client';
import { CreateBinDto, UpdateBinDto } from './dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BinsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createBinDto: CreateBinDto,
    zoneId: string,
    warehouseId: string,
  ) {
    // Los bultos solo viven en bodegas de almacenamiento (`warehouse`), no en tiendas (`store`).
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { type: true },
    });
    if (warehouse?.type === WarehouseType.store) {
      throw new BadRequestException(
        'No se pueden crear bultos en una bodega tipo almacén',
      );
    }

    return this.prisma.bin.create({ data: { ...createBinDto, zoneId } });
  }

  async update(updateBinDto: UpdateBinDto, id: string) {
    // Defensa en profundidad: resuelve Bin → Zone → Warehouse y bloquea si es `store`
    // (un bin nulo cae al update y P2025 → 404 lo maneja el filtro global).
    const bin = await this.prisma.bin.findUnique({
      where: { id },
      include: { zone: { select: { warehouse: { select: { type: true } } } } },
    });
    if (bin?.zone.warehouse.type === WarehouseType.store) {
      throw new BadRequestException(
        'No se pueden gestionar bultos en una bodega tipo almacén',
      );
    }

    return this.prisma.bin.update({ where: { id }, data: { ...updateBinDto } });
  }

  findAll(zoneId: string) {
    return this.prisma.bin.findMany({ where: { zoneId } });
  }
}

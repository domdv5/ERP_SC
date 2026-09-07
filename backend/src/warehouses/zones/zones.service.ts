import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateZoneDto, UpdateZoneDto } from './dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createZoneDto: CreateZoneDto, warehouseId: string) {
    const { name } = createZoneDto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.zone.findFirst({
        where: { warehouseId, name },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'Ya existe una zona con ese nombre en esta bodega',
        );
      }

      // Una zona es un concepto logístico transversal: se replica a TODAS las
      // bodegas activas. skipDuplicates empareja en silencio (idempotente) las
      // bodegas donde ese nombre de zona ya existía.
      const activeWarehouses = await tx.warehouse.findMany({
        where: { active: true },
        select: { id: true },
      });
      await tx.zone.createMany({
        data: activeWarehouses.map((w) => ({ warehouseId: w.id, name })),
        skipDuplicates: true,
      });

      // Contrato del endpoint sin cambios: devuelve la zona de la bodega de la URL.
      return tx.zone.findFirst({ where: { warehouseId, name } });
    });
  }

  findAll(id: string) {
    return this.prisma.zone.findMany({ where: { warehouseId: id } });
  }

  async update(updateZoneDto: UpdateZoneDto, zoneId: string) {
    const { name, active } = updateZoneDto;

    const current = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!current) {
      throw new NotFoundException('Zona no encontrada');
    }

    const isRename = name !== undefined && name !== current.name;

    // Sin rename: solo se toca esta zona. `active` es estado local por bodega.
    if (!isRename) {
      return this.prisma.zone.update({
        where: { id: zoneId },
        data: {
          ...(name !== undefined && { name }),
          ...(active !== undefined && { active }),
        },
      });
    }

    // El rename se propaga a las zonas gemelas de las otras bodegas (match por
    // nombre anterior). Si otra bodega ya tiene una zona con el nombre nuevo,
    // el @@unique dispara P2002 y el filtro global lo traduce a 409.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.zone.update({
        where: { id: zoneId },
        data: { name, ...(active !== undefined && { active }) },
      });
      await tx.zone.updateMany({
        where: { name: current.name, id: { not: zoneId } },
        data: { name },
      });
      return updated;
    });
  }
}

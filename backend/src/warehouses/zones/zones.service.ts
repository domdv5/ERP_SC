import { Injectable } from '@nestjs/common';
import { CreateZoneDto, UpdateZoneDto } from './dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createZoneDto: CreateZoneDto, id: string) {
    return this.prisma.zone.create({
      data: { ...createZoneDto, warehouseId: id },
    });
  }

  findAll(id: string) {
    return this.prisma.zone.findMany({ where: { warehouseId: id } });
  }

  update(updateZoneDto: UpdateZoneDto, id: string) {
    return this.prisma.zone.update({
      where: { id },
      data: { ...updateZoneDto },
    });
  }
}

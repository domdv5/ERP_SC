import { Injectable } from '@nestjs/common';
import { CreateBinDto, UpdateBinDto } from '@/warehouses/bins/dto';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BinsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createBinDto: CreateBinDto, zoneId: string) {
    return this.prisma.bin.create({ data: { ...createBinDto, zoneId } });
  }

  update(updateBinDto: UpdateBinDto, id: string) {
    return this.prisma.bin.update({ where: { id }, data: { ...updateBinDto } });
  }

  findAll(zoneId: string) {
    return this.prisma.bin.findMany({ where: { zoneId } });
  }
}

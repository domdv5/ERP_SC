import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  findDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  findCities(departmentCode: string) {
    return this.prisma.city.findMany({
      where: { departmentCode },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}

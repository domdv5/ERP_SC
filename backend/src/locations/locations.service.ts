import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { matchContract } from '@/common/types';
import type { City, Department } from '@/contracts';

const matchDepartmentsContract = matchContract<Department[]>();
const matchCitiesContract = matchContract<City[]>();

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findDepartments() {
    return matchDepartmentsContract(
      await this.prisma.department.findMany({ orderBy: { name: 'asc' } }),
    );
  }

  async findCities(departmentCode: string) {
    return matchCitiesContract(
      await this.prisma.city.findMany({
        where: { departmentCode },
        select: { code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    );
  }
}

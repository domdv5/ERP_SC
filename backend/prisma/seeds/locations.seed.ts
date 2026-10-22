import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

interface DivipolaData {
  departments: { code: string; name: string }[];
  cities: { code: string; name: string; departmentCode: string }[];
}

// Fuente: DANE, DIVIPOLA municipios (DIVIPOLA_Municipios.xlsx convertido a data/divipola.json)
export async function seedLocations(prisma: PrismaClient) {
  const data = JSON.parse(
    readFileSync(join(__dirname, 'data', 'divipola.json'), 'utf-8'),
  ) as DivipolaData;

  await prisma.department.createMany({
    data: data.departments,
    skipDuplicates: true,
  });
  await prisma.city.createMany({ data: data.cities, skipDuplicates: true });
}

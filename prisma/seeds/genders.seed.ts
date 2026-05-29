import { PrismaClient } from '@prisma/client';

export async function seedGenders(prisma: PrismaClient) {
  await prisma.gender.createMany({
    data: [
      { code: 'D', name: 'DAMA' },
      { code: 'H', name: 'HOMBRE' },
      { code: 'N', name: 'NIÑO' },
      { code: 'A', name: 'NIÑA' },
      { code: 'B', name: 'BEBÉ' },
      { code: 'L', name: 'LENCERÍA/HOGAR' },
    ],
    skipDuplicates: true,
  });
}

import { PrismaClient } from '@prisma/client';

// SystemConfig es una fila única (singleton) — nunca usar createMany aquí,
// crearla dos veces rompería la suposición de "una sola fila" que asume
// SystemConfigService al leer el estado en memoria.
export async function seedSystemConfig(prisma: PrismaClient) {
  const existing = await prisma.systemConfig.findFirst();
  if (!existing) {
    await prisma.systemConfig.create({ data: {} });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerCreditKind } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { toCents } from '@/common/utils/money.util';
import { assertValidCalendarDate } from '@/common/utils/date-range.util';
import { CreateExcedenteDto } from './dto/create-excedente.dto';

/** Saldo a favor por pago de más del cliente: se registra aquí y solo se usa en recibos de caja. */
@Injectable()
export class ExcedentesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(clientId: string, dto: CreateExcedenteDto, user: JwtPayload) {
    const client = await this.prisma.customer.findUnique({
      where: { id: clientId },
      include: { thirdParty: { select: { isCustomer: true } } },
    });
    if (!client || !client.thirdParty.isCustomer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (dto.customerBranchId) {
      const branch = await this.prisma.customerBranch.findFirst({
        where: { id: dto.customerBranchId, customerId: clientId },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('La sucursal no pertenece al cliente');
      }
    }

    const todayStr = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Bogota',
    });
    const dateStr = dto.date ?? todayStr;
    assertValidCalendarDate('date', dateStr);
    if (dateStr > todayStr) {
      throw new BadRequestException(
        'La fecha del excedente no puede ser futura',
      );
    }

    const amount = toCents(dto.amount) / 100;
    return this.prisma.customerCredit.create({
      data: {
        customerId: clientId,
        kind: CustomerCreditKind.excedente,
        customerBranchId: dto.customerBranchId ?? null,
        amount,
        balance: amount,
        status: 'available',
        date: new Date(dateStr),
        userId: user.sub,
      },
    });
  }

  /** Anula un excedente registrado por error; solo si nunca se usó, y queda marcado (no se borra). */
  async void(id: string, user: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      // Mismo lock que usa el recibo al aplicarlo: evita anular mientras otro recibo lo está usando.
      await tx.$queryRaw`SELECT id FROM "customer_credit" WHERE id = ${id}::uuid FOR UPDATE`;

      const credit = await tx.customerCredit.findUnique({ where: { id } });
      if (!credit) {
        throw new NotFoundException('Excedente no encontrado');
      }
      if (credit.kind !== CustomerCreditKind.excedente) {
        throw new BadRequestException('Solo se pueden anular excedentes');
      }
      if (credit.status === 'voided') {
        throw new BadRequestException('El excedente ya está anulado');
      }

      const applications = await tx.customerCreditApplication.count({
        where: { customerCreditId: id },
      });
      if (
        applications > 0 ||
        toCents(credit.balance) !== toCents(credit.amount)
      ) {
        throw new BadRequestException(
          'El excedente ya se usó en un recibo de caja y no se puede anular',
        );
      }

      return tx.customerCredit.update({
        where: { id },
        data: {
          status: 'voided',
          balance: 0,
          voidedAt: new Date(),
          voidedById: user.sub,
        },
      });
    });
  }
}

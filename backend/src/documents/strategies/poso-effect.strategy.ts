import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import { assertPaymentsMatchTotal } from '@/documents/helpers/payment.helpers';
import type {
  ConfirmContext,
  DocumentWithItems,
} from './document-effect.strategy';

/** POS oficial: solo alimenta el libro de control oficial; no valida ni mueve stock, ni crea cuentas, ni aplica saldos a favor. Sí exige la sucursal del cliente. */
@Injectable()
export class PosoEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.POSO;
  readonly tracksCustomerBranch = true;
  readonly usesTodayDate = true;
  protected readonly tracksItemAddedAt = true;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.validateCashSale(createDocumentDto);
    await this.assertValidCustomerBranch(
      createDocumentDto.thirdPartyId,
      createDocumentDto.customerBranchId,
    );
  }

  async confirm(
    _tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    _userId: string,
    context?: ConfirmContext,
  ): Promise<void> {
    // Re-chequeo: editar un borrador no vuelve a correr validateCreate.
    this.assertPricesAboveFloor(
      document.documentItems.map((item) => ({
        code: item.product.code,
        unitPrice: Number(item.unitPrice),
        minSalePrice: item.product.minSalePrice,
      })),
    );

    if (context?.appliedCustomerCredits?.length) {
      throw new BadRequestException(
        'Los saldos a favor no aplican a un POS oficial',
      );
    }

    await this.assertValidCustomerBranch(
      document.thirdPartyId,
      document.customerBranchId,
    );

    // document.total ya incluye el IVA en POSO.
    assertPaymentsMatchTotal(document.payments, document.total);
  }
}

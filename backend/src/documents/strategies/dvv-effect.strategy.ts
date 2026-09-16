import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, DvvRefundMethod, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

const VALID_REFUND_METHODS = new Set<string>(Object.values(DvvRefundMethod));

/**
 * Devolución en venta: homólogo de la devolución en compra pero del lado cliente.
 * Al confirmar entra inventario real (MovementType.return, +cantidad) valorado al
 * costo promedio vivo del producto SIN recalcularlo, y —salvo modalidad
 * devolucion_dinero— genera un saldo a favor del cliente por el total. Se valora
 * a unitPrice (lo que el cliente pagó), a diferencia de la DVC que usa unitCost.
 */
@Injectable()
export class DvvEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.DVV;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.assertValidCustomer(createDocumentDto.thirdPartyId);

    if (
      !createDocumentDto.refundMethod ||
      !VALID_REFUND_METHODS.has(createDocumentDto.refundMethod)
    ) {
      throw new BadRequestException(
        'La devolución en venta requiere una modalidad de devolución',
      );
    }
    // Sin validación de marcas: una devolución del cliente puede traer cualquier producto.
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    if (!document.thirdPartyId) {
      throw new BadRequestException('El documento requiere un cliente válido');
    }

    // Editar un borrador no re-corre validateCreate, así que se revalida cliente
    // y modalidad contra el estado definitivo (mismo motivo que EAI/T).
    await this.assertValidCustomer(document.thirdPartyId);

    if (
      !document.refundMethod ||
      !VALID_REFUND_METHODS.has(document.refundMethod)
    ) {
      throw new BadRequestException(
        'La devolución en venta requiere una modalidad de devolución',
      );
    }

    // Entrada real de stock. No se recalcula el costo promedio: la devolución no
    // es una compra, solo repone unidades al costo vivo del producto.
    for (const item of document.documentItems) {
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.return,
        quantity: item.quantity,
        unitCost: Number(item.product.avgCost),
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }

    // devolucion_dinero es la excepción: el reembolso de efectivo es manual, no
    // deja saldo a favor. saldo_a_favor y cambio_producto sí lo generan (efecto
    // idéntico; se separan solo para reportería).
    if (document.refundMethod === DvvRefundMethod.devolucion_dinero) {
      return;
    }

    // Redondeado a pesos enteros: el sistema maneja pesos sin centavos, así que
    // el saldo no debe nacer con decimales que nunca se podrían aplicar. Se
    // acepta una diferencia de hasta ~1 peso con el total del documento.
    const amount = Math.round(Number(document.total));
    await tx.customerCredit.create({
      data: {
        customerId: document.thirdPartyId,
        sourceDocumentId: document.id,
        amount,
        balance: amount,
        status: 'available',
      },
    });
  }
}

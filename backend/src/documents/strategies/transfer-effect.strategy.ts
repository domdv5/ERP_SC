import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import type { PrismaService } from '@/prisma/prisma.service';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import {
  assertSufficientBinStock,
  assertSufficientStock,
} from '@/documents/helpers/stock.helpers';

// Mismo patrón que documents/helpers/reservation.helpers.ts: los helpers de
// validación de bulto corren tanto fuera de transacción (validateCreate, con
// this.prisma) como dentro de ella (confirm, con tx) — PrismaService expone
// el mismo shape de queries que Prisma.TransactionClient para estos modelos.
type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/** T — Traslado entre bodegas: salida del origen y entrada al destino (con bulto si aplica). */
@Injectable()
export class TransferEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.T;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { warehouseId, destWarehouseId, destBinId, sourceBinId } =
      createDocumentDto;

    if (!warehouseId || !destWarehouseId || warehouseId === destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: destWarehouseId },
    });

    if (!destWarehouse) {
      throw new BadRequestException('La bodega de destino no existe');
    }

    if (destWarehouse.type === 'warehouse' && !destBinId) {
      throw new BadRequestException(
        'Los traslados hacia bodega requieren un bulto destino',
      );
    }

    if (destBinId) {
      const incomingProductId = this.assertSingleProductPerDestBin(createDocumentDto.items);
      await this.assertDestBinValid(this.prisma, destBinId, destWarehouseId, incomingProductId);
    }

    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!sourceWarehouse) {
      throw new BadRequestException('La bodega de origen no existe');
    }

    if (sourceWarehouse.type === 'warehouse' && !sourceBinId) {
      throw new BadRequestException(
        'Los traslados desde bodega requieren un bulto origen',
      );
    }

    if (sourceBinId) {
      await this.assertSourceBinValid(this.prisma, sourceBinId, warehouseId);
    }
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);
    const { destWarehouseId, destBinId, sourceBinId } = document;

    // Se revalida bin/bodega acá, no solo en validateCreate: un borrador se
    // puede editar (PATCH) sin volver a pasar por validateCreate, así que
    // confirm() no puede asumir que la consistencia sigue vigente.

    if (!destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    const [sourceWarehouse, destWarehouse] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: warehouseId } }),
      tx.warehouse.findUnique({ where: { id: destWarehouseId } }),
    ]);

    // Revalida también la OBLIGATORIEDAD del bulto (no solo su pertenencia si
    // vino informado): un borrador puede editarse vía PATCH quitando
    // sourceBinId/destBinId sin volver a pasar por validateCreate, lo que
    // antes dejaba confirmar un traslado "sin bulto" contra una bodega
    // bin-tracked — moveStock recibía binId=null y nunca tocaba BinStock,
    // permitiendo sacar/entrar stock a nivel de bodega sin respaldo en
    // ningún bulto físico concreto (rompe el invariante de forma reproducible).
    if (sourceWarehouse?.type === 'warehouse' && !sourceBinId) {
      throw new BadRequestException(
        'Los traslados desde bodega requieren un bulto origen',
      );
    }

    if (destWarehouse?.type === 'warehouse' && !destBinId) {
      throw new BadRequestException(
        'Los traslados hacia bodega requieren un bulto destino',
      );
    }

    if (destBinId) {
      const incomingProductId = this.assertSingleProductPerDestBin(document.documentItems);

      // Lock explícito sobre la fila Bin (no BinStock: puede no existir
      // ninguna fila BinStock todavía para este bin) para serializar
      // confirmaciones concurrentes hacia el mismo bulto destino. Sin este
      // lock, el SELECT de "¿está ocupado?" de abajo es una lectura suelta
      // bajo READ COMMITTED: dos traslados distintos confirmados al mismo
      // tiempo podrían ambos verlo libre antes de que cualquiera escriba, y
      // terminar mezclando stock de productos distintos en el mismo bulto
      // físico — justo lo que esta validación existe para impedir. Mismo
      // patrón que accounts-payable.service.ts::registerPayment (SELECT ...
      // FOR UPDATE para serializar pagos concurrentes contra la misma cuenta).
      await tx.$queryRaw`SELECT id FROM bin WHERE id = ${destBinId}::uuid FOR UPDATE`;
      await this.assertDestBinValid(tx, destBinId, destWarehouseId, incomingProductId);
    }

    if (sourceBinId) {
      await this.assertSourceBinValid(tx, sourceBinId, warehouseId);
    }

    for (const item of document.documentItems) {
      const quantity = item.quantity;
      const unitCost = Number(item.product.avgCost);

      await assertSufficientStock(tx, item, warehouseId, quantity);

      if (sourceBinId) {
        await assertSufficientBinStock(tx, item, sourceBinId, quantity);
      }

      // Salida de la bodega de origen.
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        binId: sourceBinId,
        movementType: MovementType.transfer,
        quantity: -quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });

      // Entrada a la bodega de destino.
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId: destWarehouseId,
        binId: destBinId,
        movementType: MovementType.transfer,
        quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }
  }

  /**
   * Valida que el bulto destino exista, pertenezca a la bodega destino y no
   * esté ocupado por un producto distinto al que llega en este traslado.
   * Compartido entre validateCreate (this.prisma, fuera de transacción) y
   * confirm (tx, dentro de la transacción que aplica los movimientos) — el
   * lock FOR UPDATE que hace real la protección contra la carrera de
   * "ocupado" vive en el llamado desde confirm(), no acá, porque
   * validateCreate no corre dentro de una transacción persistente y un lock
   * ahí no protegería nada.
   */
  private async assertDestBinValid(
    client: PrismaOrTx,
    destBinId: string,
    destWarehouseId: string,
    incomingProductId: string,
  ): Promise<void> {
    const bin = await client.bin.findUnique({
      where: { id: destBinId },
      include: { zone: { select: { warehouseId: true } } },
    });

    if (!bin || bin.zone.warehouseId !== destWarehouseId) {
      throw new BadRequestException(
        'El bulto destino no pertenece a la bodega de destino seleccionada',
      );
    }

    // Un bulto es un contenedor físico reutilizable de UN solo producto a la
    // vez: puede seguir recibiendo el mismo producto que ya contiene (se
    // suma), pero no un producto distinto mientras conserve stock del
    // anterior — antes esta regla solo vivía en el filtro de UI
    // (bin.occupied), sin ninguna defensa del lado del servidor.
    const conflictingBinStock = await client.binStock.findFirst({
      where: {
        binId: destBinId,
        quantity: { gt: 0 },
        productId: { not: incomingProductId },
      },
      include: { product: { select: { code: true } } },
    });

    if (conflictingBinStock) {
      throw new BadRequestException(
        `El bulto destino ya contiene el producto ${conflictingBinStock.product.code} — no puede recibir un producto distinto hasta vaciarse`,
      );
    }
  }

  /**
   * Valida que el bulto origen exista y pertenezca a la bodega origen. Sin
   * chequeo de "ocupado" — a diferencia del destino, un bulto origen debe
   * tener stock para poder salir de él (lo contrario sería el caso normal).
   */
  private async assertSourceBinValid(
    client: PrismaOrTx,
    sourceBinId: string,
    warehouseId: string,
  ): Promise<void> {
    const bin = await client.bin.findUnique({
      where: { id: sourceBinId },
      include: { zone: { select: { warehouseId: true } } },
    });

    if (!bin || bin.zone.warehouseId !== warehouseId) {
      throw new BadRequestException(
        'El bulto origen no pertenece a la bodega de origen seleccionada',
      );
    }
  }

  /**
   * Un bulto es un contenedor físico de un único producto: si el traslado
   * tiene como destino un bulto, todos sus ítems deben compartir el mismo
   * productId (destBinId es un campo del documento, no del ítem). Devuelve
   * ese productId único para que el llamador lo compare contra lo que ya
   * ocupa el bulto.
   */
  private assertSingleProductPerDestBin(items: { productId: string }[]): string {
    const productIds = new Set(items.map((item) => item.productId));

    if (productIds.size > 1) {
      throw new BadRequestException(
        'Un traslado hacia un bulto solo puede contener un único producto',
      );
    }

    return items[0].productId;
  }
}

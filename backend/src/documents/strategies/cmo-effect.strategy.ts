import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

/** Compra oficial: solo alimenta el libro de control oficial; no mueve stock, no crea CxP ni recalcula costos. */
@Injectable()
export class CmoEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.CMO;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { thirdPartyId, supplierInvoiceNumber, sourceDocumentId, items } =
      createDocumentDto;

    await this.assertValidSupplier(thirdPartyId);
    this.assertInvoiceNumber(supplierInvoiceNumber);

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: { id: true, code: true, brandId: true },
    });
    const codeById = new Map(products.map((p) => [p.id, p.code]));

    await this.assertItemsMatchSupplierBrands(
      thirdPartyId!,
      products.map((p) => ({ productId: p.id, brandId: p.brandId })),
    );

    this.assertPositiveCosts(
      items.map((item) => ({
        code: codeById.get(item.productId) ?? item.productId,
        unitCost: item.unitCost ?? 0,
      })),
    );

    if (sourceDocumentId) {
      await this.assertValidSource(this.prisma, {
        sourceDocumentId,
        thirdPartyId: thirdPartyId!,
      });
    }
  }

  async confirm(tx: Prisma.TransactionClient, document: DocumentWithItems) {
    const supplier = document.thirdParty?.supplier;

    if (!supplier) {
      throw new BadRequestException(
        'El documento requiere un proveedor válido',
      );
    }

    this.assertInvoiceNumber(document.supplierInvoiceNumber);

    // Re-chequeo: editar un borrador no vuelve a correr validateCreate.
    await this.assertItemsMatchSupplierBrands(
      supplier.id,
      document.documentItems.map((item) => ({
        productId: item.productId,
        brandId: item.product.brandId,
      })),
    );

    this.assertPositiveCosts(
      document.documentItems.map((item) => ({
        code: item.product.code,
        unitCost: Number(item.unitCost),
      })),
    );

    if (document.sourceDocumentId) {
      // Bloquea la CM origen para que dos CMO concurrentes no la confirmen a la vez.
      await tx.$queryRaw`SELECT id FROM document WHERE id = ${document.sourceDocumentId}::uuid FOR UPDATE`;
      await this.assertValidSource(tx, {
        sourceDocumentId: document.sourceDocumentId,
        thirdPartyId: supplier.id,
        excludeDocumentId: document.id,
      });
    }
  }

  private assertInvoiceNumber(supplierInvoiceNumber?: string | null) {
    if (!supplierInvoiceNumber?.trim()) {
      throw new BadRequestException(
        'La compra oficial requiere el número de factura del proveedor',
      );
    }
  }

  private assertPositiveCosts(items: { code: string; unitCost: number }[]) {
    const invalid = items.filter((item) => !(item.unitCost > 0));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `El costo unitario debe ser mayor a 0 en: ${invalid.map((i) => i.code).join(', ')}`,
      );
    }
  }

  /** La CM origen debe estar confirmada, ser oficial, del mismo proveedor y sin otra CMO confirmada enlazada (los borradores no cuentan). */
  private async assertValidSource(
    client: Pick<Prisma.TransactionClient, 'document'>,
    params: {
      sourceDocumentId: string;
      thirdPartyId: string;
      excludeDocumentId?: string;
    },
  ) {
    const source = await client.document.findUnique({
      where: { id: params.sourceDocumentId },
      select: {
        type: true,
        status: true,
        officialPurchase: true,
        thirdPartyId: true,
      },
    });

    if (
      !source ||
      source.type !== DocumentType.CM ||
      source.status !== DocumentStatus.confirmed ||
      !source.officialPurchase
    ) {
      throw new BadRequestException(
        'La compra de origen debe ser una compra (CM) confirmada y marcada como oficial',
      );
    }

    if (source.thirdPartyId !== params.thirdPartyId) {
      throw new BadRequestException(
        'La compra de origen pertenece a otro proveedor',
      );
    }

    const linked = await client.document.count({
      where: {
        sourceDocumentId: params.sourceDocumentId,
        type: DocumentType.CMO,
        status: DocumentStatus.confirmed,
        ...(params.excludeDocumentId && {
          id: { not: params.excludeDocumentId },
        }),
      },
    });

    if (linked > 0) {
      throw new ConflictException(
        'La compra de origen ya tiene una compra oficial confirmada enlazada',
      );
    }
  }
}

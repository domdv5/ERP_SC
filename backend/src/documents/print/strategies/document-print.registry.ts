import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { CmPrintStrategy } from './cm-print.strategy';
import { DvcPrintStrategy } from './dvc-print.strategy';
import { PosPrintStrategy } from './pos-print.strategy';
import { CotPrintStrategy } from './cot-print.strategy';
import { RemPrintStrategy } from './rem-print.strategy';
import { DvvPrintStrategy } from './dvv-print.strategy';
import { PvPrintStrategy } from './pv-print.strategy';
import { PosoPrintStrategy } from './poso-print.strategy';

/** Guarda una estrategia de impresión por tipo de documento; uno sin estrategia registrada simplemente no se puede imprimir. */
@Injectable()
export class DocumentPrintRegistry {
  private readonly strategies = new Map<DocumentType, DocumentPrintStrategy>();

  constructor(
    cmPrintStrategy: CmPrintStrategy,
    dvcPrintStrategy: DvcPrintStrategy,
    posPrintStrategy: PosPrintStrategy,
    cotPrintStrategy: CotPrintStrategy,
    remPrintStrategy: RemPrintStrategy,
    dvvPrintStrategy: DvvPrintStrategy,
    pvPrintStrategy: PvPrintStrategy,
    posoPrintStrategy: PosoPrintStrategy,
  ) {
    for (const strategy of [
      cmPrintStrategy,
      dvcPrintStrategy,
      posPrintStrategy,
      cotPrintStrategy,
      remPrintStrategy,
      dvvPrintStrategy,
      pvPrintStrategy,
      posoPrintStrategy,
    ]) {
      this.strategies.set(strategy.type, strategy);
    }
  }

  get(type: DocumentType): DocumentPrintStrategy {
    const strategy = this.strategies.get(type);

    if (!strategy) {
      throw new BadRequestException(
        'Este tipo de documento no soporta impresión todavía',
      );
    }

    return strategy;
  }
}

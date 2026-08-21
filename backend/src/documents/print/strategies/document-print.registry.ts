import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentPrintStrategy } from './document-print.strategy';
import { CmPrintStrategy } from './cm-print.strategy';
import { DvcPrintStrategy } from './dvc-print.strategy';

/**
 * Registro de estrategias de impresión por tipo de documento — mismo patrón
 * que DocumentEffectsRegistry. Un tipo sin estrategia registrada es, por
 * definición, un tipo que aún no soporta impresión (fase 2).
 */
@Injectable()
export class DocumentPrintRegistry {
  private readonly strategies = new Map<DocumentType, DocumentPrintStrategy>();

  constructor(
    cmPrintStrategy: CmPrintStrategy,
    dvcPrintStrategy: DvcPrintStrategy,
  ) {
    for (const strategy of [cmPrintStrategy, dvcPrintStrategy]) {
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

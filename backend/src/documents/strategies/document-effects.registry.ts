import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { DocumentEffectStrategy } from './document-effect.strategy';
import { CmEffectStrategy } from './cm-effect.strategy';
import { DvcEffectStrategy } from './dvc-effect.strategy';
import { EaiEffectStrategy } from './eai-effect.strategy';
import { SajEffectStrategy } from './saj-effect.strategy';
import { TransferEffectStrategy } from './transfer-effect.strategy';

/**
 * Registro de estrategias por tipo de documento.
 * Un tipo sin estrategia registrada es, por definición, un tipo
 * aún no soportado (fase 2): el get() lanza el BadRequestException
 * y el service no necesita ninguna lista de tipos.
 */
@Injectable()
export class DocumentEffectsRegistry {
  private readonly strategies = new Map<DocumentType, DocumentEffectStrategy>();

  constructor(
    cmEffectStrategy: CmEffectStrategy,
    dvcEffectStrategy: DvcEffectStrategy,
    eaiEffectStrategy: EaiEffectStrategy,
    sajEffectStrategy: SajEffectStrategy,
    transferEffectStrategy: TransferEffectStrategy,
  ) {
    for (const strategy of [
      cmEffectStrategy,
      dvcEffectStrategy,
      eaiEffectStrategy,
      sajEffectStrategy,
      transferEffectStrategy,
    ]) {
      this.strategies.set(strategy.type, strategy);
    }
  }

  get(type: DocumentType): DocumentEffectStrategy {
    const strategy = this.strategies.get(type);

    if (!strategy) {
      throw new BadRequestException('Tipo de documento aún no soportado');
    }

    return strategy;
  }
}

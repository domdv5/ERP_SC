import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type {
  DocumentEffectStrategy,
  ReservationEffectStrategy,
} from './document-effect.strategy';
import { isReservationStrategy } from './document-effect.strategy';
import { CmEffectStrategy } from './cm-effect.strategy';
import { DvcEffectStrategy } from './dvc-effect.strategy';
import { EaiEffectStrategy } from './eai-effect.strategy';
import { PvEffectStrategy } from './pv-effect.strategy';
import { RemEffectStrategy } from './rem-effect.strategy';
import { PosEffectStrategy } from './pos-effect.strategy';
import { CotEffectStrategy } from './cot-effect.strategy';
import { SajEffectStrategy } from './saj-effect.strategy';
import { TransferEffectStrategy } from './transfer-effect.strategy';

/** Guarda una estrategia por cada tipo de documento. Un tipo sin estrategia registrada es, por definición, uno que todavía no está soportado: al pedirlo se lanza el error, sin necesidad de una lista aparte. */
@Injectable()
export class DocumentEffectsRegistry {
  private readonly strategies = new Map<DocumentType, DocumentEffectStrategy>();

  constructor(
    cmEffectStrategy: CmEffectStrategy,
    dvcEffectStrategy: DvcEffectStrategy,
    eaiEffectStrategy: EaiEffectStrategy,
    sajEffectStrategy: SajEffectStrategy,
    transferEffectStrategy: TransferEffectStrategy,
    pvEffectStrategy: PvEffectStrategy,
    remEffectStrategy: RemEffectStrategy,
    posEffectStrategy: PosEffectStrategy,
    cotEffectStrategy: CotEffectStrategy,
  ) {
    for (const strategy of [
      cmEffectStrategy,
      dvcEffectStrategy,
      eaiEffectStrategy,
      sajEffectStrategy,
      transferEffectStrategy,
      pvEffectStrategy,
      remEffectStrategy,
      posEffectStrategy,
      cotEffectStrategy,
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

  /** Igual que obtener la estrategia, pero además exige que sepa manejar reservas. */
  getReservation(type: DocumentType): ReservationEffectStrategy {
    const strategy = this.get(type);

    if (!isReservationStrategy(strategy)) {
      throw new BadRequestException(
        'Este tipo de documento no maneja reservas',
      );
    }

    return strategy;
  }
}

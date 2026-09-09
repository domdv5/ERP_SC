import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import { AbstractReservationStrategy } from './abstract-reservation.strategy';

/** Remisión: documento transitorio, casi igual a la preventa. Reserva stock de forma lógica (sin mover inventario) y se puede convertir en venta. Toda la lógica está en la clase base de reservas. */
@Injectable()
export class RemEffectStrategy extends AbstractReservationStrategy {
  readonly type = DocumentType.REM;
  protected readonly entityNoun = 'la remisión';
}

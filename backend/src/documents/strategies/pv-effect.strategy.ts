import { Injectable } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import { AbstractReservationStrategy } from './abstract-reservation.strategy';

/** Preventa: reserva stock de forma lógica para un cliente y un vendedor, sin mover inventario. Toda la lógica está en la clase base de reservas. */
@Injectable()
export class PvEffectStrategy extends AbstractReservationStrategy {
  readonly type = DocumentType.PV;
  protected readonly entityNoun = 'la preventa';
}

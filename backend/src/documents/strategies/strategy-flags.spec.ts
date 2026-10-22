import type { PrismaService } from '@/prisma/prisma.service';
import { CmEffectStrategy } from './cm-effect.strategy';
import { CotEffectStrategy } from './cot-effect.strategy';
import { DvvEffectStrategy } from './dvv-effect.strategy';
import { PosEffectStrategy } from './pos-effect.strategy';
import { PosoEffectStrategy } from './poso-effect.strategy';
import { PvEffectStrategy } from './pv-effect.strategy';
import { RemEffectStrategy } from './rem-effect.strategy';
import { TransferEffectStrategy } from './transfer-effect.strategy';

const prisma = {} as PrismaService;
const NOW = new Date('2026-10-22T17:00:00.000Z');
const SCANNED = '2026-10-22T16:54:08.000Z';

describe('resolveItemAddedAt', () => {
  it.each([
    PosEffectStrategy,
    PosoEffectStrategy,
    CotEffectStrategy,
    RemEffectStrategy,
    DvvEffectStrategy,
  ])('%p usa la hora en que se agregó el producto al carrito', (Strategy) => {
    const strategy = new Strategy(prisma);
    expect(strategy.resolveItemAddedAt(SCANNED, NOW)).toEqual(
      new Date(SCANNED),
    );
  });

  it('las ventas sin hora del carrito usan la hora del servidor', () => {
    expect(
      new PosEffectStrategy(prisma).resolveItemAddedAt(undefined, NOW),
    ).toEqual(NOW);
  });

  it.each([CmEffectStrategy, PvEffectStrategy])(
    '%p ignora la hora del carrito y usa la del servidor',
    (Strategy) => {
      expect(new Strategy(prisma).resolveItemAddedAt(SCANNED, NOW)).toEqual(
        NOW,
      );
    },
  );
});

describe('tracksCustomerBranch', () => {
  it.each([
    PvEffectStrategy,
    RemEffectStrategy,
    CotEffectStrategy,
    PosEffectStrategy,
    DvvEffectStrategy,
    PosoEffectStrategy,
  ])('%p guarda la sucursal del cliente', (Strategy) => {
    expect(new Strategy(prisma).tracksCustomerBranch).toBe(true);
  });

  it.each([CmEffectStrategy, TransferEffectStrategy])(
    '%p no guarda la sucursal del cliente',
    (Strategy) => {
      expect(new Strategy(prisma).tracksCustomerBranch).toBe(false);
    },
  );
});

describe('usesTodayDate', () => {
  it.each([
    RemEffectStrategy,
    PosEffectStrategy,
    PosoEffectStrategy,
    CotEffectStrategy,
  ])('%p siempre lleva la fecha de hoy', (Strategy) => {
    expect(new Strategy(prisma).usesTodayDate).toBe(true);
  });

  it.each([CmEffectStrategy, PvEffectStrategy, DvvEffectStrategy])(
    '%p conserva la fecha elegida',
    (Strategy) => {
      expect(new Strategy(prisma).usesTodayDate).toBe(false);
    },
  );
});

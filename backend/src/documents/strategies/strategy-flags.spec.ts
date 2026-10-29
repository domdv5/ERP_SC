import type { PrismaService } from '@/prisma/prisma.service';
import type { DocumentEffectStrategy } from './document-effect.strategy';
import { CmEffectStrategy } from './cm-effect.strategy';
import { CmoEffectStrategy } from './cmo-effect.strategy';
import { CotEffectStrategy } from './cot-effect.strategy';
import { DvcEffectStrategy } from './dvc-effect.strategy';
import { DvvEffectStrategy } from './dvv-effect.strategy';
import { EaiEffectStrategy } from './eai-effect.strategy';
import { PosEffectStrategy } from './pos-effect.strategy';
import { PosoEffectStrategy } from './poso-effect.strategy';
import { PvEffectStrategy } from './pv-effect.strategy';
import { RemEffectStrategy } from './rem-effect.strategy';
import { SajEffectStrategy } from './saj-effect.strategy';
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

const ALL_STRATEGIES = [
  CmEffectStrategy,
  CmoEffectStrategy,
  CotEffectStrategy,
  DvcEffectStrategy,
  DvvEffectStrategy,
  EaiEffectStrategy,
  PosEffectStrategy,
  PosoEffectStrategy,
  PvEffectStrategy,
  RemEffectStrategy,
  SajEffectStrategy,
  TransferEffectStrategy,
];

describe('tracksReceiver', () => {
  it('CM guarda quién recibe la mercancía', () => {
    expect(new CmEffectStrategy(prisma).tracksReceiver).toBe(true);
  });

  it.each(ALL_STRATEGIES.filter((Strategy) => Strategy !== CmEffectStrategy))(
    '%p no guarda receptor',
    (Strategy) => {
      expect(new Strategy(prisma).tracksReceiver).toBe(false);
    },
  );
});

describe('undoEffects', () => {
  const WITH_UNDO: (typeof ALL_STRATEGIES)[number][] = [
    CmEffectStrategy,
    EaiEffectStrategy,
    PvEffectStrategy,
    RemEffectStrategy,
  ];

  it.each(WITH_UNDO)('%p define efectos propios al anular', (Strategy) => {
    const strategy: DocumentEffectStrategy = new Strategy(prisma);
    expect(typeof strategy.undoEffects).toBe('function');
  });

  it.each(ALL_STRATEGIES.filter((Strategy) => !WITH_UNDO.includes(Strategy)))(
    '%p no define efectos propios al anular',
    (Strategy) => {
      const strategy: DocumentEffectStrategy = new Strategy(prisma);
      expect(strategy.undoEffects).toBeUndefined();
    },
  );
});

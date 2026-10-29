import { DocumentStatus, DocumentType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentVoidService } from './document-void.service';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentEffectsRegistry } from './strategies/document-effects.registry';
import { CmEffectStrategy } from './strategies/cm-effect.strategy';
import { EaiEffectStrategy } from './strategies/eai-effect.strategy';
import { PvEffectStrategy } from './strategies/pv-effect.strategy';
import { RemEffectStrategy } from './strategies/rem-effect.strategy';
import {
  applyStockChange,
  calculateAvgCostAfterVoid,
  findLastPurchaseCostAfterVoid,
} from './helpers/stock.helpers';

export const ALL_TYPES = Object.values(DocumentType);
export const SALE_TYPES = [
  DocumentType.POS,
  DocumentType.COT,
  DocumentType.POSO,
  DocumentType.REM,
];

const noPrisma = {} as PrismaService;
const REAL_STRATEGIES: Partial<Record<DocumentType, object>> = {
  [DocumentType.CM]: new CmEffectStrategy(noPrisma),
  [DocumentType.EAI]: new EaiEffectStrategy(noPrisma),
  [DocumentType.PV]: new PvEffectStrategy(noPrisma),
  [DocumentType.REM]: new RemEffectStrategy(noPrisma),
};

export const makeUser = (permissions: string[]) =>
  ({ sub: 'u1', permissions }) as unknown as JwtPayload;

export const fullUser = makeUser([
  ...ALL_TYPES.map((type) => `document.create.${type}`),
  ...SALE_TYPES.map((type) => `document.void.${type}`),
]);

export const makeMovement = (overrides: Record<string, unknown> = {}) => ({
  productId: 'p1',
  warehouseId: 'w1',
  binId: null,
  quantity: 5,
  unitCost: 100,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  documentItemId: 'i1',
  documentItem: { unitCost: 100 },
  ...overrides,
});

export const makeDocument = (
  type: DocumentType,
  overrides: Record<string, unknown> = {},
) => ({
  id: 'doc-1',
  type,
  status: DocumentStatus.confirmed,
  sourceDocumentId: null,
  documentItems: [{ id: 'i1', productId: 'p1', quantity: 5 }],
  derivedDocuments: [],
  inventoryMovements: [],
  accountsPayable: [],
  accountsReceivable: [],
  supplierCredits: [],
  customerCredits: [],
  appliedCustomerCredits: [],
  ...overrides,
});

export function createVoidHarness() {
  const tx = {
    $queryRaw: jest.fn(),
    document: { updateMany: jest.fn(), findUnique: jest.fn() },
    documentItem: { findMany: jest.fn(), findFirst: jest.fn() },
    reservationRelease: { createMany: jest.fn() },
    inventoryMovement: { findFirst: jest.fn(), create: jest.fn() },
    product: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    warehouse: { findUniqueOrThrow: jest.fn() },
    accountsPayable: { findMany: jest.fn(), deleteMany: jest.fn() },
    accountsReceivable: { findMany: jest.fn(), deleteMany: jest.fn() },
    supplierCredit: { findUnique: jest.fn(), deleteMany: jest.fn() },
    customerCredit: { deleteMany: jest.fn() },
  };
  const prisma = {
    document: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const registry = { get: jest.fn() };
  const documentsQuery = new DocumentsQueryService(
    prisma as unknown as PrismaService,
  );
  const service = new DocumentVoidService(
    prisma as unknown as PrismaService,
    registry as unknown as DocumentEffectsRegistry,
    documentsQuery,
  );
  const found = { id: 'doc-1' };

  const loadDocument = (
    type: DocumentType,
    overrides: Record<string, unknown> = {},
  ) =>
    prisma.document.findUnique.mockResolvedValue(makeDocument(type, overrides));

  const rawSql = () =>
    tx.$queryRaw.mock.calls.map((call) => (call[0] as string[]).join('?'));

  return {
    tx,
    prisma,
    registry,
    service,
    documentsQuery,
    found,
    loadDocument,
    rawSql,
  };
}

export type VoidHarness = ReturnType<typeof createVoidHarness>;

export function resetVoidHarness({
  tx,
  prisma,
  registry,
  documentsQuery,
  found,
}: VoidHarness) {
  jest.resetAllMocks();
  prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) =>
    fn(tx),
  );
  registry.get.mockImplementation(
    (type: DocumentType) => REAL_STRATEGIES[type] ?? {},
  );
  tx.document.updateMany.mockResolvedValue({ count: 1 });
  tx.documentItem.findMany.mockResolvedValue([]);
  tx.inventoryMovement.findFirst.mockResolvedValue(null);
  tx.product.findUniqueOrThrow.mockResolvedValue({
    avgCost: 80,
    code: 'PRD-1',
  });
  tx.warehouse.findUniqueOrThrow.mockResolvedValue({ type: 'general' });
  tx.accountsPayable.findMany.mockResolvedValue([]);
  tx.accountsReceivable.findMany.mockResolvedValue([]);
  tx.supplierCredit.findUnique.mockResolvedValue(null);
  jest.mocked(applyStockChange).mockResolvedValue({
    previousStock: 10,
    newStock: 5,
  });
  jest.mocked(calculateAvgCostAfterVoid).mockResolvedValue(75);
  jest.mocked(findLastPurchaseCostAfterVoid).mockResolvedValue(90);
  jest.spyOn(documentsQuery, 'findOne').mockResolvedValue(found as never);
}

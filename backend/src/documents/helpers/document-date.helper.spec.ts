import { resolveDocumentDate } from './document-date.helper';

// 2026-10-22 20:30 en Bogotá = 2026-10-23 01:30 UTC
const NIGHT_IN_BOGOTA = new Date('2026-10-23T01:30:00.000Z');

describe('resolveDocumentDate', () => {
  it('con fecha fija ignora la pedida y usa hoy en Bogotá', () => {
    expect(resolveDocumentDate(true, '2026-01-05', NIGHT_IN_BOGOTA)).toEqual(
      new Date('2026-10-22T00:00:00.000Z'),
    );
  });

  it('con fecha fija y sin fecha pedida también usa hoy en Bogotá', () => {
    expect(resolveDocumentDate(true, undefined, NIGHT_IN_BOGOTA)).toEqual(
      new Date('2026-10-22T00:00:00.000Z'),
    );
  });

  it('sin fecha fija conserva la fecha pedida', () => {
    expect(resolveDocumentDate(false, '2026-01-05', NIGHT_IN_BOGOTA)).toEqual(
      new Date('2026-01-05'),
    );
  });

  it('sin fecha fija y sin fecha pedida no cambia la fecha', () => {
    expect(
      resolveDocumentDate(false, undefined, NIGHT_IN_BOGOTA),
    ).toBeUndefined();
  });
});

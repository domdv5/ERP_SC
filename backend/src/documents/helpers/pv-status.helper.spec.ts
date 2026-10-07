import { DocumentStatus, DocumentType } from '@/common/enums';
import { PvDerivedDoc, buildPvStatus } from './pv-status.helper';

function derived(
  id: string,
  status: DocumentStatus,
  type: DocumentType = DocumentType.POS,
): PvDerivedDoc {
  return { id, type, number: `000${id}`, status };
}

describe('buildPvStatus', () => {
  it('devuelve null para tipos sin reserva convertible (CM, POS, COT)', () => {
    expect(
      buildPvStatus({ type: DocumentType.CM, derivedDocuments: [] }),
    ).toBeNull();
    expect(
      buildPvStatus({ type: DocumentType.POS, derivedDocuments: [] }),
    ).toBeNull();
    expect(
      buildPvStatus({ type: DocumentType.COT, derivedDocuments: [] }),
    ).toBeNull();
  });

  it('una PV sin derivados está en none', () => {
    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: [],
    });

    expect(result).toEqual({ conversion: { status: 'none', documents: [] } });
  });

  it('una REM se trata igual que una PV', () => {
    const result = buildPvStatus({
      type: DocumentType.REM,
      derivedDocuments: [],
    });

    expect(result?.conversion.status).toBe('none');
  });

  it('si todos los derivados están anulados sigue en none', () => {
    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: [
        derived('1', DocumentStatus.voided),
        derived('2', DocumentStatus.voided),
      ],
    });

    expect(result?.conversion.status).toBe('none');
  });

  it('un derivado en borrador sin ninguno confirmado deja la PV en pending', () => {
    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: [derived('1', DocumentStatus.draft)],
    });

    expect(result?.conversion.status).toBe('pending');
  });

  it('un derivado confirmado deja la PV en converted', () => {
    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: [derived('1', DocumentStatus.confirmed)],
    });

    expect(result?.conversion.status).toBe('converted');
  });

  it('converted gana sobre pending cuando hay un borrador y un confirmado', () => {
    const result = buildPvStatus({
      type: DocumentType.REM,
      derivedDocuments: [
        derived('1', DocumentStatus.draft),
        derived('2', DocumentStatus.confirmed),
      ],
    });

    expect(result?.conversion.status).toBe('converted');
  });

  it('un confirmado anulado no cuenta: con un borrador queda en pending', () => {
    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: [
        derived('1', DocumentStatus.voided),
        derived('2', DocumentStatus.draft),
      ],
    });

    expect(result?.conversion.status).toBe('pending');
  });

  it('documents incluye todos los derivados, también los anulados', () => {
    const docs = [
      derived('1', DocumentStatus.voided),
      derived('2', DocumentStatus.confirmed, DocumentType.COT),
    ];

    const result = buildPvStatus({
      type: DocumentType.PV,
      derivedDocuments: docs,
    });

    expect(result?.conversion.documents).toEqual(docs);
  });
});

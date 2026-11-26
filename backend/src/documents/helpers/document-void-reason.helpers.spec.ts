import { BadRequestException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import { resolveVoidReason } from './document-void-reason.helpers';

describe('resolveVoidReason', () => {
  it('la salida por ajuste no se anula', () => {
    expect(() =>
      resolveVoidReason(DocumentType.SAJ, 'cantidad_equivocada', undefined),
    ).toThrow(
      new BadRequestException(
        'La salida por ajuste no se anula: corrígela con una entrada por ajuste (EAI).',
      ),
    );
  });

  it.each([
    DocumentType.CM,
    DocumentType.CMO,
    DocumentType.DVC,
    DocumentType.DVV,
    DocumentType.EAI,
  ])('%s sin motivo se rechaza', (type) => {
    expect(() => resolveVoidReason(type, undefined, undefined)).toThrow(
      new BadRequestException('Elige el motivo de la anulación'),
    );
  });

  it.each([
    [DocumentType.CM, 'cliente_equivocado'],
    [DocumentType.DVC, 'cliente_equivocado'],
    [DocumentType.CMO, 'cliente_equivocado'],
    [DocumentType.CMO, 'bodega_equivocada'],
    [DocumentType.DVV, 'proveedor_equivocado'],
    [DocumentType.EAI, 'proveedor_equivocado'],
    [DocumentType.EAI, 'cliente_equivocado'],
    [DocumentType.EAI, 'operacion_no_realizada'],
  ] as const)('%s rechaza el motivo %s porque no le aplica', (type, reason) => {
    expect(() => resolveVoidReason(type, reason, undefined)).toThrow(
      new BadRequestException('Ese motivo no aplica a este documento'),
    );
  });

  it('"otro" sin texto se rechaza, también si es solo espacios', () => {
    const error = new BadRequestException('Escribe el motivo de la anulación');
    expect(() => resolveVoidReason(DocumentType.CM, 'otro', undefined)).toThrow(
      error,
    );
    expect(() => resolveVoidReason(DocumentType.CM, 'otro', '   ')).toThrow(
      error,
    );
  });

  it('"otro" con texto guarda el texto recortado', () => {
    expect(
      resolveVoidReason(DocumentType.DVV, 'otro', '  cliente se arrepintió  '),
    ).toEqual({ reason: 'otro', reasonOther: 'cliente se arrepintió' });
  });

  it('un motivo que aplica se guarda y descarta el texto libre', () => {
    expect(
      resolveVoidReason(DocumentType.CM, 'costo_equivocado', 'sobra'),
    ).toEqual({ reason: 'costo_equivocado', reasonOther: null });
    expect(
      resolveVoidReason(DocumentType.DVV, 'cliente_equivocado', undefined),
    ).toEqual({ reason: 'cliente_equivocado', reasonOther: null });
    expect(
      resolveVoidReason(DocumentType.EAI, 'bodega_equivocada', undefined),
    ).toEqual({ reason: 'bodega_equivocada', reasonOther: null });
  });

  it.each([
    DocumentType.POS,
    DocumentType.COT,
    DocumentType.POSO,
    DocumentType.REM,
    DocumentType.T,
    DocumentType.PV,
  ])('%s se anula sin motivo y no guarda uno aunque llegue', (type) => {
    expect(resolveVoidReason(type, undefined, undefined)).toEqual({
      reason: null,
      reasonOther: null,
    });
    expect(resolveVoidReason(type, 'otro', 'algo')).toEqual({
      reason: null,
      reasonOther: null,
    });
  });
});

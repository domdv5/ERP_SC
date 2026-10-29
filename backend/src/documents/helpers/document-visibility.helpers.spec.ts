import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import {
  assertCanViewDocument,
  findVisibleDocumentTypes,
} from './document-visibility.helpers';

describe('findVisibleDocumentTypes', () => {
  it('deriva los tipos de document.create.{T} y document.void.{T}, sin repetir', () => {
    expect(
      findVisibleDocumentTypes([
        'document.create.CM',
        'document.void.POS',
        'document.create.POS',
        'document.read',
        'document.create.NOEXISTE',
      ]).sort(),
    ).toEqual([DocumentType.CM, DocumentType.POS].sort());
  });
});

describe('assertCanViewDocument', () => {
  it('deja ver un tipo que el rol crea', () => {
    expect(() =>
      assertCanViewDocument(['document.create.T'], DocumentType.T),
    ).not.toThrow();
  });

  it('deja ver un tipo que el rol solo convierte (facturación con preventas)', () => {
    expect(() =>
      assertCanViewDocument(['document.convert.PV'], DocumentType.PV),
    ).not.toThrow();
  });

  it('liberar una reserva no da visibilidad', () => {
    expect(() =>
      assertCanViewDocument(['document.release.PV'], DocumentType.PV),
    ).toThrow(ForbiddenException);
  });

  it('deja ver un tipo que el rol solo anula', () => {
    expect(() =>
      assertCanViewDocument(['document.void.COT'], DocumentType.COT),
    ).not.toThrow();
  });

  it('rechaza con 403 un tipo fuera del rol', () => {
    expect(() =>
      assertCanViewDocument(['document.create.T'], DocumentType.CM),
    ).toThrow(
      new ForbiddenException('No tiene permiso para ver documentos de tipo CM'),
    );
  });

  it.each(['ar.read', 'ap.read', 'official.read'])(
    'con %s ve cualquier tipo (cartera y libro oficial enlazan a todos)',
    (permission) => {
      expect(() =>
        assertCanViewDocument([permission], DocumentType.DVV),
      ).not.toThrow();
    },
  );
});

import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import {
  assertCanViewDocument,
  findVisibleDocumentTypes,
  STOCK_MOVING_TYPES,
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

  describe('con inventory_case.read', () => {
    it('lista exactamente los tipos que mueven inventario', () => {
      expect(findVisibleDocumentTypes(['inventory_case.read']).sort()).toEqual(
        [
          DocumentType.CM,
          DocumentType.DVC,
          DocumentType.EAI,
          DocumentType.SAJ,
          DocumentType.T,
          DocumentType.POS,
          DocumentType.COT,
          DocumentType.DVV,
        ].sort(),
      );
    });

    it('se une a los tipos que el rol ya ve por sus permisos', () => {
      const visible = findVisibleDocumentTypes([
        'inventory_case.read',
        'document.create.PV',
      ]);

      expect(visible).toContain(DocumentType.PV);
      expect(visible).toEqual(expect.arrayContaining(STOCK_MOVING_TYPES));
      expect(visible).not.toContain(DocumentType.CMO);
    });
  });

  it.each(['ar.read', 'ap.read', 'official.read'])(
    'con %s lista todos los tipos (mismo alcance que el detalle)',
    (permission) => {
      expect(findVisibleDocumentTypes([permission]).sort()).toEqual(
        Object.values(DocumentType).sort(),
      );
    },
  );
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

  it.each(STOCK_MOVING_TYPES)(
    'con solo inventory_case.read ve el tipo %s',
    (type) => {
      expect(() =>
        assertCanViewDocument(['inventory_case.read'], type),
      ).not.toThrow();
    },
  );

  it.each([DocumentType.CMO, DocumentType.POSO, DocumentType.PV])(
    'con solo inventory_case.read rechaza con 403 el tipo %s',
    (type) => {
      expect(() =>
        assertCanViewDocument(['inventory_case.read'], type),
      ).toThrow(
        new ForbiddenException(
          `No tiene permiso para ver documentos de tipo ${type}`,
        ),
      );
    },
  );

  it.each(['ar.read', 'ap.read', 'official.read'])(
    'con %s ve cualquier tipo (cartera y libro oficial enlazan a todos)',
    (permission) => {
      expect(() =>
        assertCanViewDocument([permission], DocumentType.DVV),
      ).not.toThrow();
    },
  );
});

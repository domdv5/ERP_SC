import type { DocumentForPrint } from '@/documents/documents-query.service';
import { buildHeader } from './header.block';

const MEDELLIN = { name: 'MEDELLÍN', department: { name: 'ANTIOQUIA' } };
const CALI = {
  name: 'SANTIAGO DE CALI',
  department: { name: 'VALLE DEL CAUCA' },
};

function headerText(document: unknown, showBranch: boolean): string {
  const header = buildHeader(document as DocumentForPrint, 'FACTURA', {
    showBranch,
  }) as () => unknown;
  return JSON.stringify(header());
}

describe('buildHeader ciudad', () => {
  const document = {
    number: 1,
    date: '2026-10-21T00:00:00.000Z',
    thirdParty: { name: 'Cliente', city: MEDELLIN },
    customerBranch: { name: 'Sede Cali', city: CALI },
  };

  it('muestra la ciudad de la sucursal cuando se imprime la sucursal', () => {
    const text = headerText(document, true);
    expect(text).toContain('SANTIAGO DE CALI, VALLE DEL CAUCA');
    expect(text).not.toContain('MEDELLÍN, ANTIOQUIA');
  });

  it('muestra la ciudad del tercero si no se imprime la sucursal', () => {
    expect(headerText(document, false)).toContain('MEDELLÍN, ANTIOQUIA');
  });

  it('no muestra ciudad si nadie la tiene', () => {
    const text = headerText(
      {
        ...document,
        thirdParty: { name: 'Cliente', city: null },
        customerBranch: null,
      },
      true,
    );
    expect(text).not.toContain('ANTIOQUIA');
    expect(text).not.toContain('VALLE');
  });
});

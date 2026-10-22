interface PrintCity {
  name: string;
  department: { name: string };
}

interface WithCity {
  city: PrintCity | null;
}

// La factura muestra la ciudad de la sucursal; si no tiene, la del tercero
export function formatPrintCity(
  branch: WithCity | null | undefined,
  thirdParty: WithCity | null | undefined,
): string | null {
  const city = branch?.city ?? thirdParty?.city;
  if (!city) return null;
  return city.name === city.department.name
    ? city.name
    : `${city.name}, ${city.department.name}`;
}

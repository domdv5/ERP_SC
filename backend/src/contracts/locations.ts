// Contrato de ubicaciones (DIVIPOLA): lo que entregan los endpoints de /locations, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`).

export interface Department {
  code: string;
  name: string;
}

export interface City {
  code: string;
  name: string;
}

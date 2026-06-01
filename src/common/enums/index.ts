export enum MovementType {
  Purchase     = 'purchase',
  Sale         = 'sale',
  Return       = 'return',
  Transfer     = 'transfer',
  Adjustment   = 'adjustment',
  InitialStock = 'initial_stock',
  Void         = 'void',
  Production   = 'production',
}

export enum DocumentType {
  CM    = 'CM',
  DVC   = 'DVC',
  RMDVC = 'RMDVC',
  PE    = 'PE',
  EAI   = 'EAI',
  SAJ   = 'SAJ',
  COT   = 'COT',
  POS   = 'POS',
  REM   = 'REM',
  DVV   = 'DVV',
  T     = 'T',
}

export enum DocumentStatus {
  Draft     = 'draft',
  Confirmed = 'confirmed',
  Voided    = 'voided',
}

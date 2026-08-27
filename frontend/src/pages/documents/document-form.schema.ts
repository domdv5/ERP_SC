import { z } from 'zod'

export const itemSchema = z.object({
  productId:     z.string().min(1, 'Selecciona un producto'),
  productCode:   z.string(),
  productDesc:   z.string(),
  quantity:      z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitCost:      z.coerce.number().nonnegative('El costo no puede ser negativo').optional(),
  // Solo preventas (PV) — precio de venta de la línea; el backend usa salePrice si se omite.
  unitPrice:     z.coerce.number().nonnegative('El precio no puede ser negativo').optional(),
  // Nota de talla por línea — solo se usa/muestra en traslados (T), ver showObservaciones en
  // ProductRow.tsx. z.literal('') admite el input vacío del formulario sin fallar la validación.
  observaciones: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
})

export const formSchema = z.object({
  // 'POS'/'COT' se incluyen solo para que existingDoc.type (DocumentType) tipe correctamente
  // al hacer reset() en modo edición — DocumentFormPage nunca los ofrece como opción
  // seleccionable (ver availableTypes) y redirige fuera del form si detecta un borrador de
  // venta existente (esos tipos se editan solo desde POSCheckoutPage).
  type:            z.enum(['CM', 'DVC', 'EAI', 'SAJ', 'T', 'PV', 'POS', 'COT'] as const),
  date:            z.string().min(1, 'La fecha es requerida'),
  thirdPartyId:    z.string().optional(),
  // Solo preventas (PV) — vendedora responsable de la operación.
  sellerId:        z.string().optional(),
  warehouseId:     z.string().optional(),
  sourceBinId:     z.string().optional(),
  destWarehouseId: z.string().optional(),
  destBinId:       z.string().optional(),
  // Solo EAI — motivo del ajuste; adjustmentReasonOther se valida como obligatorio en el
  // superRefine de abajo solo cuando adjustmentReason === 'otro'.
  adjustmentReason:      z.enum(['negativo', 'inventario_general', 'traspaso_costo', 'otro'] as const).optional(),
  adjustmentReasonOther: z.string().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  notes:           z.string().optional(),
  items:           z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
}).superRefine((data, ctx) => {
  if (data.type === 'CM' || data.type === 'DVC') {
    if (!data.thirdPartyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El proveedor es requerido', path: ['thirdPartyId'] })
    }
  }
  if (data.type === 'PV') {
    if (!data.thirdPartyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El cliente es requerido', path: ['thirdPartyId'] })
    }
    if (!data.sellerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La vendedora es requerida', path: ['sellerId'] })
    }
  }
  if (data.type === 'EAI') {
    data.items.forEach((item, index) => {
      if (item.unitCost === undefined || item.unitCost <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El costo unitario es obligatorio y debe ser mayor a cero',
          path: ['items', index, 'unitCost'],
        })
      }
    })
    if (!data.adjustmentReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El motivo del ajuste es requerido', path: ['adjustmentReason'] })
    }
    if (data.adjustmentReason === 'otro' && !data.adjustmentReasonOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Describe el motivo del ajuste', path: ['adjustmentReasonOther'] })
    }
  }
  if (data.type === 'T') {
    if (!data.warehouseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La bodega origen es requerida', path: ['warehouseId'] })
    }
    if (!data.destWarehouseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La bodega destino es requerida', path: ['destWarehouseId'] })
    }
    if (data.warehouseId && data.destWarehouseId && data.warehouseId === data.destWarehouseId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Las bodegas origen y destino deben ser distintas', path: ['destWarehouseId'] })
    }
    if (data.destBinId) {
      const distinctProductIds = new Set(data.items.map((item) => item.productId))
      if (distinctProductIds.size > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Un traslado a bulto solo puede contener un único producto',
          path: ['destBinId'],
        })
      }
    }
  }
})

export type FormValues = z.infer<typeof formSchema>

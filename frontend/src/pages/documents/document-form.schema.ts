import { z } from 'zod'

export const itemSchema = z.object({
  productId:     z.string().min(1, 'Selecciona un producto'),
  productCode:   z.string(),
  productDesc:   z.string(),
  quantity:      z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  unitCost:      z.coerce.number().nonnegative('El costo no puede ser negativo').optional(),
  // Nota de talla por línea — solo se usa/muestra en traslados (T), ver showObservaciones en
  // ProductRow.tsx. z.literal('') admite el input vacío del formulario sin fallar la validación.
  observaciones: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
})

export const formSchema = z.object({
  type:            z.enum(['CM', 'DVC', 'EAI', 'SAJ', 'T'] as const),
  date:            z.string().min(1, 'La fecha es requerida'),
  thirdPartyId:    z.string().optional(),
  warehouseId:     z.string().optional(),
  sourceBinId:     z.string().optional(),
  destWarehouseId: z.string().optional(),
  destBinId:       z.string().optional(),
  freight:         z.coerce.number().nonnegative('El flete no puede ser negativo').optional(),
  notes:           z.string().optional(),
  items:           z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
}).superRefine((data, ctx) => {
  if (data.type === 'CM' || data.type === 'DVC') {
    if (!data.thirdPartyId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El proveedor es requerido', path: ['thirdPartyId'] })
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
  }
})

export type FormValues = z.infer<typeof formSchema>

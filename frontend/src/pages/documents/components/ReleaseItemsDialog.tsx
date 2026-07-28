import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { X, Unlock, Loader2 } from "lucide-react";
import { releaseItems } from "@/services/documents.service";
import { cn } from "@/lib/utils";
import type { Document, ReleaseItemsPayload } from "@/types/document.types";

// ─── schema ──────────────────────────────────────────────────────────────────

const releaseRowSchema = z.object({
  documentItemId: z.string(),
  productLabel: z.string(),
  pending: z.number(),
  checked: z.boolean(),
  quantity: z.coerce.number(),
});

const baseSchema = z.object({
  items: z.array(releaseRowSchema),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
});

// Validación por fila vive en un superRefine a nivel de formulario (no en releaseRowSchema)
// porque cada fila necesita comparar quantity contra su propio pending — mismo patrón que
// RegisterPaymentForm.tsx usa para validar cada nota crédito contra su balance disponible.
const releaseSchema = baseSchema.superRefine((data, ctx) => {
  const anyChecked = data.items.some((item) => item.checked);
  if (!anyChecked) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecciona al menos un ítem para liberar",
      path: ["items"],
    });
  }
  data.items.forEach((item, index) => {
    if (!item.checked) return;
    if (item.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La cantidad debe ser mayor a 0",
        path: ["items", index, "quantity"],
      });
    } else if (item.quantity > item.pending) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La cantidad no puede superar la cantidad pendiente (${item.pending})`,
        path: ["items", index, "quantity"],
      });
    }
  });
});

type ReleaseFormValues = z.infer<typeof baseSchema>;

const emptyDefaults = (): ReleaseFormValues => ({ items: [], notes: "" });

// ─── props ───────────────────────────────────────────────────────────────────

interface ReleaseItemsDialogProps {
  open: boolean;
  // Nombrado `doc` (no `document`) a propósito, en línea con DocumentDetailPage.tsx — evita
  // sombrear el global `document` del DOM dentro del componente.
  doc: Document;
  onClose: () => void;
}

export function ReleaseItemsDialog({ open, doc, onClose }: ReleaseItemsDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReleaseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(releaseSchema) as any,
    defaultValues: emptyDefaults(),
  });

  const { fields, replace } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!open) return;
    replace(
      doc.documentItems.map((item) => {
        const pending = item.quantity - (item.releasedQuantity ?? 0);
        return {
          documentItemId: item.id,
          productLabel: `${item.product.code} — ${item.product.description}`,
          pending,
          checked: false,
          quantity: pending,
        };
      }),
    );
    reset(undefined, { keepValues: true });
  }, [open, doc, replace, reset]);

  const { mutate: doRelease, isPending } = useMutation({
    mutationFn: (payload: ReleaseItemsPayload) => releaseItems(doc.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", doc.id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // Namespace separado del combobox de producto en ProductRow — 'products' no lo cubre por
      // prefijo, así que sin esto el disponible mostrado en la siguiente operación queda desactualizado.
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
      toast.success("Reserva liberada correctamente");
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al liberar stock. Intenta nuevamente o contacta al administrador.");
    },
  });

  if (!open) return null;

  const watchedItems = watch("items");

  const submitHandler = (data: ReleaseFormValues) => {
    const items = data.items
      .filter((item) => item.checked)
      .map((item) => ({ documentItemId: item.documentItemId, quantity: item.quantity }));
    doRelease({ items, notes: data.notes || undefined });
  };

  const itemsError = typeof errors.items?.message === "string" ? errors.items.message : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 shrink-0">
              <Unlock className="w-4 h-4 text-white/80" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Liberar Stock</h2>
              <p className="text-white/50 text-xs mt-0.5 font-accent">
                Selecciona los ítems y la cantidad a liberar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body + Footer */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form
          onSubmit={handleSubmit(submitHandler as any)}
          className="flex flex-col overflow-hidden"
        >
          <div className="px-6 py-5 space-y-3 overflow-y-auto">
            {itemsError && (
              <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {itemsError}
              </p>
            )}

            {fields.map((field, index) => {
              const item = doc.documentItems[index];
              const pending = field.pending;
              const isDisabled = pending <= 0;
              const rowError = errors.items?.[index]?.quantity?.message;

              return (
                <div
                  key={field.id}
                  className={cn(
                    "p-3 rounded-lg border border-ui-border-medium bg-surface-raised",
                    isDisabled && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={isDisabled}
                      {...register(`items.${index}.checked`)}
                      className="mt-1 w-4 h-4 rounded border-ui-border-medium text-brand-secondary focus:ring-brand-secondary/40 disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-content text-sm font-medium truncate">
                        {field.productLabel}
                      </p>
                      <p className="text-content-faint text-xs mt-0.5 font-accent">
                        Reservado: {item.quantity.toLocaleString("es-CO")} &middot; Liberado:{" "}
                        {(item.releasedQuantity ?? 0).toLocaleString("es-CO")} &middot; Pendiente:{" "}
                        {pending.toLocaleString("es-CO")}
                      </p>
                      {isDisabled ? (
                        <p className="text-xs text-content-faint mt-1.5">Liberado completamente</p>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="text-xs text-content-secondary shrink-0">
                            Cantidad a liberar
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={pending}
                            step={1}
                            disabled={!watchedItems?.[index]?.checked}
                            {...register(`items.${index}.quantity`)}
                            className={cn(
                              "w-24 px-2.5 py-1.5 text-sm rounded-lg border bg-surface text-content",
                              "focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              rowError ? "border-red-500" : "border-ui-border-medium",
                            )}
                          />
                        </div>
                      )}
                      {rowError && <p className="text-red-500 text-xs mt-1">{rowError}</p>}
                    </div>
                  </div>
                </div>
              );
            })}

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">
                Notas (opcional)
              </label>
              <textarea
                rows={2}
                {...register("notes")}
                placeholder="Observaciones de la liberación..."
                className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all resize-none"
              />
              {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes.message}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-ui-border flex justify-end gap-3 bg-surface-raised shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-ui-border-medium rounded-lg hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 gradient-action"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Liberar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

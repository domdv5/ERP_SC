import {
  useEffect,
  useMemo,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupplierCredits } from "@/services/accounts-payable.service";
import { formatCOP, formatDate } from "@/pages/accounts-payable/accounts-payable.utils";
import type { RegisterPayablePaymentPayload } from "@/types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// `balance` viaja en cada fila del form solo para validar en el cliente que no se
// aplique más de lo disponible — se descarta antes de enviar el payload al backend.
const creditApplicationSchema = z.object({
  supplierCreditId: z.string(),
  balance: z.number(),
  amount: z.coerce.number().min(0, "El monto no puede ser negativo"),
});

const baseSchema = z.object({
  // El efectivo ahora puede ser 0: un pago puede saldarse solo con notas crédito (ver plan 020).
  amount: z.coerce.number().min(0, "El monto no puede ser negativo"),
  paymentDate: z.string().min(1, "La fecha es requerida"),
  paymentMethod: z.string().min(1, "Selecciona un método de pago"),
  bankDestination: z.string().optional(),
  reference: z.string().optional(),
  creditApplications: z.array(creditApplicationSchema),
});

export type RegisterPaymentFormValues = z.infer<typeof baseSchema>;

const PAYMENT_METHODS = [
  { value: "Efectivo", label: "Efectivo" },
  { value: "Transferencia", label: "Transferencia" },
  { value: "Cheque", label: "Cheque" },
  { value: "Tarjeta", label: "Tarjeta" },
  { value: "Otro", label: "Otro" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegisterPaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RegisterPayablePaymentPayload) => void;
  isPending: boolean;
  /** Saldo pendiente actual de la cuenta — usado para validar que el pago no lo exceda. */
  pendingBalance: number;
  /** Proveedor dueño de la cuenta — usado para consultar sus notas crédito disponibles. */
  supplierId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all",
        className,
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

const emptyDefaults = (): RegisterPaymentFormValues => ({
  amount: 0,
  paymentDate: today(),
  paymentMethod: "",
  bankDestination: "",
  reference: "",
  creditApplications: [],
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterPaymentForm({
  open,
  onClose,
  onSubmit,
  isPending,
  pendingBalance,
  supplierId,
}: RegisterPaymentFormProps) {
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ["accounts-payable", "credits", supplierId],
    queryFn: () => getSupplierCredits(supplierId),
    staleTime: 5 * 60 * 1000,
    enabled: open && Boolean(supplierId),
  });

  // superRefine valida ambos lados del pago juntos (efectivo + créditos aplicados) contra
  // el saldo pendiente, y cada fila de crédito contra su propio balance disponible.
  const schema = useMemo(
    () =>
      baseSchema.superRefine((data, ctx) => {
        const creditsTotal = data.creditApplications.reduce((sum, c) => sum + c.amount, 0);
        const total = data.amount + creditsTotal;

        if (total <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "Ingresa un monto en efectivo o aplica al menos una nota crédito",
            path: ["amount"],
          });
        }

        if (total > pendingBalance) {
          ctx.addIssue({
            code: "custom",
            message: `El monto no puede superar el saldo pendiente (${formatCOP(pendingBalance)})`,
            path: ["amount"],
          });
        }

        data.creditApplications.forEach((c, index) => {
          if (c.amount > c.balance) {
            ctx.addIssue({
              code: "custom",
              message: `No puede superar el saldo disponible (${formatCOP(c.balance)})`,
              path: ["creditApplications", index, "amount"],
            });
          }
        });
      }),
    [pendingBalance],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RegisterPaymentFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: emptyDefaults(),
  });

  const { fields, replace } = useFieldArray({ control, name: "creditApplications" });

  useEffect(() => {
    if (open) {
      reset(emptyDefaults());
    }
  }, [open, reset]);

  // Puebla las filas de crédito una vez que la consulta resuelve — separado del reset de
  // apertura porque la consulta de créditos llega después de que `open` pasa a true.
  useEffect(() => {
    if (open && credits) {
      replace(credits.map((c) => ({ supplierCreditId: c.id, balance: c.balance, amount: 0 })));
    }
  }, [open, credits, replace]);

  const watchedAmount = watch("amount");
  const watchedCredits = watch("creditApplications");
  const totalApplied =
    (Number(watchedAmount) || 0) +
    watchedCredits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  if (!open) return null;

  const submitHandler = (data: RegisterPaymentFormValues) => {
    const creditApplications = data.creditApplications
      .filter((c) => c.amount > 0)
      .map((c) => ({ supplierCreditId: c.supplierCreditId, amount: c.amount }));

    onSubmit({
      amount: data.amount,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      bankDestination: data.bankDestination,
      reference: data.reference,
      ...(creditApplications.length > 0 ? { creditApplications } : {}),
    });
  };

  const creditsSection = isLoadingCredits ? (
    <div className="space-y-2">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-surface-hover animate-pulse" />
      ))}
    </div>
  ) : credits && credits.length > 0 ? (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div key={field.id}>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-ui-border-medium bg-surface-raised">
            <div className="min-w-0">
              <p className="text-content text-sm font-medium">
                Nota crédito &middot; {formatDate(credits[index]?.createdAt ?? null)}
              </p>
              <p className="text-content-faint text-xs mt-0.5 font-accent">
                Disponible: {formatCOP(field.balance)}
              </p>
            </div>
            <Input
              {...register(`creditApplications.${index}.amount`)}
              type="number"
              min={0}
              max={field.balance}
              step="0.01"
              placeholder="0"
              className="w-28 shrink-0"
            />
          </div>
          {errors.creditApplications?.[index]?.amount && (
            <p className="text-red-500 text-xs mt-1">
              {errors.creditApplications[index]?.amount?.message}
            </p>
          )}
        </div>
      ))}
    </div>
  ) : (
    <p className="text-content-faint text-xs font-accent py-1">
      Este proveedor no tiene notas crédito disponibles.
    </p>
  );

  console.log("credits:", credits);
  console.log("fields:", fields);
  console.log("creditApplications:", watch("creditApplications"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark shrink-0">
          <div>
            <h2 className="text-white font-semibold">Registrar pago</h2>
            <p className="text-white/50 text-xs mt-0.5 font-accent">
              Saldo pendiente: {formatCOP(pendingBalance)}
            </p>
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
        <form
          onSubmit={handleSubmit(submitHandler as never)}
          className="flex flex-col overflow-hidden"
        >
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <Field label="Monto en efectivo" error={errors.amount?.message}>
              <Input
                {...register("amount")}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                autoFocus
              />
            </Field>

            <Field label="Fecha de pago" error={errors.paymentDate?.message}>
              <Input {...register("paymentDate")} type="date" />
            </Field>

            <Field label="Método de pago" error={errors.paymentMethod?.message}>
              <Select {...register("paymentMethod")} defaultValue="">
                <option value="" disabled>
                  Selecciona un método
                </option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Banco destino (opcional)" error={errors.bankDestination?.message}>
              <Input
                {...register("bankDestination")}
                placeholder="Ej: Bancolombia"
                autoComplete="off"
              />
            </Field>

            <Field label="Referencia (opcional)" error={errors.reference?.message}>
              <Input
                {...register("reference")}
                placeholder="Ej: N° de comprobante"
                autoComplete="off"
              />
            </Field>

            {/* Aplicar saldo a favor */}
            <div className="pt-2 border-t border-ui-divide">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-content-muted" />
                <p className="text-sm font-medium text-content-secondary">Aplicar saldo a favor</p>
              </div>
              {creditsSection}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-content-faint font-accent">Total a aplicar</span>
              <span
                className={cn(
                  "font-medium",
                  totalApplied > pendingBalance ? "text-red-500" : "text-content-secondary",
                )}
              >
                {formatCOP(totalApplied)} / {formatCOP(pendingBalance)}
              </span>
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
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 gradient-action"
            >
              {isPending ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

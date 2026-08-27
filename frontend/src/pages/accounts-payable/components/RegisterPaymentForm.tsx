import {
  useEffect,
  useMemo,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFirstErrorMessage } from "@/lib/form-errors";
import { ThousandsInput } from "@/components/shared";
import { getSupplierCredits } from "@/services/accounts-payable.service";
import { formatCOP, formatDate } from "@/pages/accounts-payable/accounts-payable.utils";
import type { RegisterPayablePaymentPayload } from "@/types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// `balance` viaja en cada fila del form solo para validar en el cliente que no se
// aplique más de lo disponible — se descarta antes de enviar el payload al backend.
// ThousandsInput emite `undefined` cuando el campo queda vacío → preprocess lo trata como 0
// (una fila/monto vacío = "no aplica"), así el superRefine siempre suma números.
const moneyAmount = z.preprocess(
  (v) => (v == null ? 0 : v),
  z.number().min(0, "El monto no puede ser negativo"),
);

const creditApplicationSchema = z.object({
  supplierCreditId: z.string(),
  // La API serializa el Decimal de balance como string — coercionar para el superRefine.
  balance: z.coerce.number(),
  amount: moneyAmount,
});

const baseSchema = z.object({
  // El efectivo ahora puede ser 0: un pago puede saldarse solo con notas crédito (ver plan 020).
  amount: moneyAmount,
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      {children}
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
    setValue,
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
      replace(credits.map((c) => ({ supplierCreditId: c.id, balance: Number(c.balance), amount: 0 })));
    }
  }, [open, credits, replace]);

  const watchedAmount = watch("amount");
  const watchedCredits = watch("creditApplications");
  const cashApplied = Number(watchedAmount) || 0;
  const creditsApplied = watchedCredits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalApplied = cashApplied + creditsApplied;

  // Efectivo que falta para saldar la cuenta una vez descontadas las notas crédito ya aplicadas.
  const cashRemainder = Math.max(0, pendingBalance - creditsApplied);

  // Para una fila de nota crédito: lo máximo aplicable = min(disponible de la nota, lo que
  // falta para cubrir el saldo con el resto del pago fijo).
  const creditRowMax = (index: number) => {
    const otherCredits = watchedCredits.reduce(
      (sum, c, i) => (i === index ? sum : sum + (Number(c.amount) || 0)),
      0,
    );
    const remaining = Math.max(0, pendingBalance - cashApplied - otherCredits);
    return Math.min(watchedCredits[index]?.balance ?? 0, remaining);
  };

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
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-ui-border-medium bg-surface-raised">
            <div className="min-w-0">
              <p className="text-content text-sm font-medium">
                Nota crédito &middot; {formatDate(credits[index]?.createdAt ?? null)}
              </p>
              <p className="text-content-faint text-xs mt-0.5 font-accent">
                Disponible: {formatCOP(field.balance)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setValue(`creditApplications.${index}.amount`, creditRowMax(index), { shouldValidate: true })}
                className="text-[11px] font-medium text-brand-secondary hover:underline disabled:opacity-40 disabled:no-underline"
                disabled={creditRowMax(index) === 0}
              >
                Máx
              </button>
              <Controller
                control={control}
                name={`creditApplications.${index}.amount`}
                render={({ field: f }) => (
                  <ThousandsInput
                    name={f.name}
                    value={f.value}
                    onChange={f.onChange}
                    onBlur={f.onBlur}
                    ref={f.ref}
                    placeholder="0"
                    className="w-24"
                  />
                )}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-content-faint text-xs font-accent py-1">
      Este proveedor no tiene notas crédito disponibles.
    </p>
  );

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
          onSubmit={handleSubmit(
            submitHandler as never,
            (formErrors) => toast.error(getFirstErrorMessage(formErrors)),
          )}
          noValidate
          className="flex flex-col overflow-hidden"
        >
          <div className="px-6 py-5 space-y-4 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-content-secondary">
                  Monto en efectivo
                </label>
                <button
                  type="button"
                  onClick={() => setValue("amount", cashRemainder, { shouldValidate: true })}
                  className="text-xs font-medium text-brand-secondary hover:underline disabled:opacity-40 disabled:no-underline"
                  disabled={cashRemainder === 0 || cashApplied === cashRemainder}
                >
                  Pagar saldo restante
                </button>
              </div>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <ThousandsInput
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="0"
                    autoFocus
                  />
                )}
              />
            </div>

            <Field label="Fecha de pago">
              <Input {...register("paymentDate")} type="date" />
            </Field>

            <Field label="Método de pago">
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

            <Field label="Banco destino (opcional)">
              <Input
                {...register("bankDestination")}
                placeholder="Ej: Bancolombia"
                autoComplete="off"
              />
            </Field>

            <Field label="Referencia (opcional)">
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

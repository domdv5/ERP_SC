import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Wallet,
  Calendar,
  FileText,
  CreditCard,
  Landmark,
  Hash,
  Plus,
} from "lucide-react";
import { getAccountPayable, registerPayablePayment } from "@/services/accounts-payable.service";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./components/StatusBadge";
import { RegisterPaymentForm } from "./components/RegisterPaymentForm";
import { formatCOP, formatDate, DOCUMENT_TYPE_LABELS, docNumber } from "./accounts-payable.utils";
import type { RegisterPayablePaymentPayload } from "@/types";

export default function AccountsPayableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const canManage = usePermission("ap.manage");
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);

  const {
    data: account,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["accounts-payable", id],
    queryFn: () => getAccountPayable(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  });

  const { mutate: registerPayment, isPending: isRegistering } = useMutation({
    mutationFn: (payload: RegisterPayablePaymentPayload) => registerPayablePayment(id!, payload),
    onSuccess: () => {
      // El prefijo ["accounts-payable"] ya cubre ["accounts-payable", "credits", supplierId] y
      // ["accounts-payable", id] por coincidencia parcial de query key — se listan explícitas
      // igual para que quede claro qué se está invalidando tras aplicar un pago con crédito.
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable", id] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable", "credits"] });
      setPaymentFormOpen(false);
      toast.success("Pago registrado correctamente");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al registrar el pago");
    },
  });

  // ── loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-lg bg-surface-hover animate-pulse"
              style={{ width: `${60 + i * 10}%` }}
            />
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/accounts-payable")}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a cuentas por pagar
        </button>
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar la cuenta por pagar</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-brand-secondary hover:underline"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const creditApplications = account.creditApplications ?? [];
  // El saldo pendiente debe descontar tanto el efectivo como las notas crédito ya aplicadas
  // (ver plan 020) — omitir creditApplications aquí subestimaría cuánto falta por pagar.
  const paidAmount =
    account.payablePayments.reduce((sum, payment) => sum + payment.amount, 0) +
    creditApplications.reduce((sum, application) => sum + application.amount, 0);
  const pendingBalance = account.totalAmount - paidAmount;

  type SettlementRow = {
    id: string;
    date: string;
    amount: number;
    kind: "cash" | "credit";
    paymentMethod: string | null;
    bankDestination: string | null;
    reference: string | null;
  };

  const settlementRows: SettlementRow[] = [
    ...account.payablePayments.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      amount: payment.amount,
      kind: "cash" as const,
      paymentMethod: payment.paymentMethod,
      bankDestination: payment.bankDestination,
      reference: payment.reference,
    })),
    ...creditApplications.map((application) => ({
      id: application.id,
      date: application.appliedAt,
      amount: application.amount,
      kind: "credit" as const,
      paymentMethod: null,
      bankDestination: null,
      reference: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={() => navigate("/accounts-payable")}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a cuentas por pagar
      </button>

      {/* Header card */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
              {account.supplier.thirdParty.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl text-content">{account.supplier.thirdParty.name}</h1>
                <StatusBadge status={account.status} />
              </div>
              <p className="text-content-muted text-sm mt-1 font-accent">
                Documento {docNumber(account.document.type, account.document.number)} &middot;{" "}
                {DOCUMENT_TYPE_LABELS[account.document.type] ?? account.document.type}
              </p>
            </div>
          </div>

          {canManage && pendingBalance > 0 && (
            <button
              onClick={() => setPaymentFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="w-4 h-4" />
              Registrar pago
            </button>
          )}
        </div>

        {/* Meta grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 border-t border-ui-divide pt-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Monto total</p>
              <p className="text-sm text-content font-medium">{formatCOP(account.totalAmount)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo pendiente</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  pendingBalance > 0 ? "text-content" : "text-brand-secondary",
                )}
              >
                {formatCOP(pendingBalance)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Vencimiento</p>
              <p className="text-sm text-content font-medium">{formatDate(account.dueDate)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Fecha documento</p>
              <p className="text-sm text-content font-medium">
                {formatDate(account.document.date)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Historial de pagos</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {settlementRows.length}{" "}
            {settlementRows.length === 1 ? "movimiento registrado" : "movimientos registrados"}
          </p>
        </div>

        {settlementRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
              <CreditCard className="w-7 h-7 text-white/60" />
            </div>
            <p className="text-content-muted text-sm font-medium">Aún no hay movimientos registrados</p>
            <p className="text-content-faint text-xs mt-1 font-accent">
              {canManage
                ? 'Usa el botón "Registrar pago" para añadir el primero'
                : "Los pagos y aplicaciones de crédito aparecerán aquí una vez se registren"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {["Fecha", "Monto", "Método", "Banco destino", "Referencia"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {settlementRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(row.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.kind === "credit" ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                          Nota crédito aplicada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-content-muted text-xs">
                          <Landmark className="w-3.5 h-3.5 text-content-faint" />
                          {row.paymentMethod}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {row.bankDestination ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {row.reference ? (
                        <span className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-content-faint" />
                          {row.reference}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register payment modal */}
      <RegisterPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSubmit={(data) => registerPayment(data)}
        isPending={isRegistering}
        pendingBalance={pendingBalance}
        supplierId={account.supplier.id}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Wallet, Clock, CheckCircle2 } from "lucide-react";
import { getAccountsPayable } from "@/services/accounts-payable.service";
import {
  StatsGrid,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from "@/components/shared";
import { StatusBadge } from "./components/StatusBadge";
import { formatCOP, formatDate, DOCUMENT_TYPE_LABELS, docNumber } from "./accounts-payable.utils";
import type { AccountsPayableStatus } from "@/types";

const ALL_STATUSES: { value: AccountsPayableStatus | ""; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "paid", label: "Pagado" },
];

export default function AccountsPayableListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountsPayableStatus | "">("");
  const [page, setPage] = useState(1);

  const [debouncedSearch] = useDebounce(search, 400);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["accounts-payable", debouncedSearch, statusFilter, page],
    queryFn: () =>
      getAccountsPayable({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  // Lightweight status counts for the stats row — the backend doesn't return
  // status breakdowns in the list meta, so we ask for a single row per status.
  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ["accounts-payable", "count", "pending"],
    queryFn: () => getAccountsPayable({ status: "pending", page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paidData, isLoading: isPaidLoading } = useQuery({
    queryKey: ["accounts-payable", "count", "paid"],
    queryFn: () => getAccountsPayable({ status: "paid", page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const pendingCount = pendingData?.meta.total ?? 0;
  const paidCount = paidData?.meta.total ?? 0;

  const statCards = [
    {
      label: "Total",
      value: total,
      icon: Wallet,
      bg: "bg-brand-primary/10",
      fg: "text-brand-primary dark:text-content",
    },
    {
      label: "Pendientes",
      value: pendingCount,
      icon: Clock,
      bg: "bg-amber-500/10",
      fg: "text-amber-500",
    },
    {
      label: "Pagadas",
      value: paidCount,
      icon: CheckCircle2,
      bg: "bg-brand-secondary/10",
      fg: "text-brand-secondary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Cuentas por Pagar</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Obligaciones con proveedores y su estado de pago
          </p>
        </div>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading || isPendingLoading || isPaidLoading} />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="border-b border-ui-border">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por proveedor..."
            isLoading={isLoading}
            itemCount={items.length}
            total={total}
            onRefresh={refetch}
          />
          <div className="px-5 pb-4 flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AccountsPayableStatus | "")}
              className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isError && (
          <ErrorState message="Error al cargar las cuentas por pagar" onRetry={refetch} />
        )}

        {isLoading && <TableSkeleton rows={6} widths={["w-40", "w-28", "w-24", "w-20"]} />}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Wallet}
            title={
              debouncedSearch
                ? `Sin resultados para "${debouncedSearch}"`
                : "No hay cuentas por pagar registradas"
            }
            description={
              debouncedSearch
                ? "Prueba con otro término de búsqueda"
                : "Las cuentas se generan automáticamente al confirmar compras"
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {["Proveedor", "Documento", "Monto total", "Vencimiento", "Estado"].map((h) => (
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
                {items.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() => navigate(`/accounts-payable/${account.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                          {account.supplier.thirdParty.name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <p className="font-medium text-content">
                          {account.supplier.thirdParty.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-content">
                          {docNumber(account.document.type, account.document.number)}
                        </span>
                        <span className="text-xs text-content-faint">
                          {DOCUMENT_TYPE_LABELS[account.document.type] ?? account.document.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(account.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(account.dueDate)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={account.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isError && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Pencil,
  Trash2,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Calendar,
  Warehouse,
  ArrowRight,
  Loader2,
  Unlock,
  UserCog,
  ShoppingCart,
  Printer,
  Clock,
} from "lucide-react";

import {
  getDocument,
  confirmDocument,
  voidDocument,
  deleteDocument,
  duplicateDocument,
  printDocument,
} from "@/services/documents.service";
import { usePermission } from "@/hooks/usePermission";
import { cn, daysSince, formatDaysSince } from "@/lib/utils";
import {
  DOC_TYPE_BADGE,
  DOC_TYPE_ACCENT,
  DOC_STATUS_BADGE,
  PV_CONVERSION_BADGE,
} from "./document.constants";
import { ReleaseItemsDialog } from "./components/ReleaseItemsDialog";
import { getPendingQuantity, hasPendingItems } from "./pos-checkout.utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

// El backend ya manda el número con ceros a la izquierda; el relleno de acá es por si acaso.
const fmtDocRef = (type: string, number: string | number) =>
  `${type}-${String(number).padStart(6, "0")}`;

// ─── label maps ──────────────────────────────────────────────────────────────

const TYPE_LABELS = DOC_TYPE_BADGE;
const STATUS_LABELS = DOC_STATUS_BADGE;

// Cuando la petición pide un archivo (PDF), la respuesta de error también llega como archivo,
// no como JSON, aunque el backend haya mandado un error normal. Hay que leerla como texto y
// parsearla a mano para sacar el mensaje.
async function extractPrintErrorMessage(err: unknown): Promise<string | undefined> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string };
      return parsed.message;
    } catch {
      return undefined;
    }
  }
  return (data as { message?: string } | undefined)?.message;
}

// ─── confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  icon: React.ReactNode;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmClass,
  isPending,
  onConfirm,
  onCancel,
  icon,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border border-ui-border shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">{icon}</div>
          <div>
            <h3 className="text-base text-content mb-2">{title}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-opacity disabled:opacity-60",
              confirmClass,
            )}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── detail page ─────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);

  const canReleasePV = usePermission("document.release.PV");
  const canConvertPV = usePermission("document.convert.PV");
  const canReleaseREM = usePermission("document.release.REM");
  const canConvertREM = usePermission("document.convert.REM");
  const canDuplicateCM = usePermission("document.create.CM");

  const {
    data: doc,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["document", id],
    queryFn: () => getDocument(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["document", id] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    // El buscador de productos usa una clave de caché aparte que "products" no alcanza; sin
    // esto, el costo promedio que se ve en la siguiente operación queda viejo.
    queryClient.invalidateQueries({ queryKey: ["products-search"] });
    // Claves de caché propias del checkout de ventas: confirmar o anular una venta cambia el
    // stock disponible, y sin esto el checkout lo sigue mostrando viejo hasta recargar.
    queryClient.invalidateQueries({ queryKey: ["product-by-code"] });
    queryClient.invalidateQueries({ queryKey: ["products-search-pos"] });
    // Una compra crea su cuenta por pagar y una devolución crea o elimina la nota crédito al confirmar o anular.
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    // Confirmar o anular un traslado cambia el stock de los bultos; el detalle de la bodega
    // debe refrescarse, si no el form de un traslado nuevo sigue mostrando bultos ocupados o
    // libres que ya no lo están.
    queryClient.invalidateQueries({ queryKey: ["warehouse-detail"] });
  };

  const { mutate: doConfirm, isPending: isConfirming } = useMutation({
    mutationFn: () => confirmDocument(id!),
    onSuccess: () => {
      invalidate();
      setConfirmOpen(false);
      toast.success("Operación confirmada. El inventario fue actualizado.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al confirmar la operación");
    },
  });

  const { mutate: doVoid, isPending: isVoiding } = useMutation({
    mutationFn: () => voidDocument(id!),
    onSuccess: () => {
      invalidate();
      setVoidOpen(false);
      toast.success("Operación anulada. Los movimientos de inventario fueron revertidos.");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al anular la operación");
    },
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Operación eliminada correctamente");
      navigate("/documents");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al eliminar la operación");
    },
  });

  const { mutate: doDuplicate, isPending: isDuplicating } = useMutation({
    mutationFn: () => duplicateDocument(id!),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      const newDocNumber = `${newDoc.type}-${String(newDoc.number).padStart(6, "0")}`;
      toast.success(`Compra duplicada como ${newDocNumber}, editable como borrador.`);
      navigate(`/documents/${newDoc.id}/edit`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al duplicar la operación");
    },
  });

  const { mutate: doPrint, isPending: isPrinting } = useMutation({
    mutationFn: () => printDocument(id!),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // La pestaña nueva necesita el enlace del PDF mientras carga; se libera después de un
      // rato en vez de al instante.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: async (err: unknown) => {
      const msg = await extractPrintErrorMessage(err);
      toast.error(msg ?? "Error al generar el PDF");
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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/documents")}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a operaciones
        </button>
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <FileText className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar la operación</p>
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

  const docNumber = `${doc.type}-${String(doc.number).padStart(6, "0")}`;
  const typeInfo = TYPE_LABELS[doc.type];
  const accentInfo = DOC_TYPE_ACCENT[doc.type];
  const statusInfo = STATUS_LABELS[doc.status];
  const isDraft = doc.status === "draft";
  const isConfirmed = doc.status === "confirmed";
  const isVoided = doc.status === "voided";

  // Las salidas por ajuste y los traslados no guardan costo ni subtotal en la línea: solo
  // usan el costo promedio del producto para el movimiento de inventario. Por eso, para esos
  // dos tipos, el costo y el subtotal se calculan en vivo desde el costo promedio del
  // producto, en vez de leer unos campos que siempre valen cero.
  const usesAvgCostFallback = doc.type === "SAJ" || doc.type === "T";
  // Preventas y remisiones comparten toda la mecánica de reserva y conversión: no guardan
  // costo (lo que importa es el precio de venta de la línea), tienen columnas Liberado y
  // Pendiente, panel "Liberar Stock", botón "Convertir a venta" y chip de conversión.
  const isReservationType = doc.type === "PV" || doc.type === "REM";
  const canRelease = doc.type === "PV" ? canReleasePV : doc.type === "REM" ? canReleaseREM : false;
  const canConvert = doc.type === "PV" ? canConvertPV : doc.type === "REM" ? canConvertREM : false;
  // Bloque de estado de conversión que arma el backend; solo llega en preventas y remisiones, y aun así puede venir vacío.
  const pvConversion = isReservationType ? doc.pv?.conversion : undefined;
  const pvConvBadge =
    pvConversion && pvConversion.status !== "none"
      ? PV_CONVERSION_BADGE[pvConversion.status]
      : null;
  // Venta derivada todavía vigente. Mientras exista, el documento no se puede anular ni volver
  // a convertir: se ocultan esos botones y se ofrece un acceso directo a esa venta.
  const pvActiveDerived = pvConversion?.documents.find((d) => d.status !== "voided");
  // Antigüedad solo mientras la reserva sigue abierta: confirmada y sin conversión en curso ni hecha.
  const pvAgeLabel =
    isReservationType && isConfirmed && pvConversion?.status === "none"
      ? formatDaysSince(daysSince(doc.createdAt))
      : null;
  // Tipos que se valoran al precio de venta, no al costo (misma lista que en el backend). En
  // estos, la línea guarda el precio de venta y el costo queda en cero.
  const isPriceBasedType =
    doc.type === "PV" || doc.type === "REM" || doc.type === "POS" || doc.type === "COT";
  const itemUnitCost = (item: (typeof doc.documentItems)[number]) =>
    isPriceBasedType ? item.unitPrice : usesAvgCostFallback ? Number(item.product.avgCost) : item.unitCost;
  const itemSubtotal = (item: (typeof doc.documentItems)[number]) =>
    isPriceBasedType
      ? item.subtotal
      : usesAvgCostFallback
        ? item.quantity * Number(item.product.avgCost)
        : item.subtotal;

  // El subtotal llega como texto aunque el tipo diga que es número. Sin convertirlo, a partir
  // de la segunda línea la suma concatena texto en vez de sumar. Bug real visto en una venta
  // de 2 líneas (con una sola coincidía de casualidad); afecta a cualquier documento con más
  // de una línea.
  const itemsTotal = doc.documentItems.reduce((sum, item) => sum + Number(itemSubtotal(item)), 0);
  // Nota de talla por línea: solo se muestra en traslados, donde un mismo producto puede
  // repartirse en varios bultos con tallas distintas.
  const showObservaciones = doc.type === "T";
  // Las salidas por ajuste y los traslados muestran el costo promedio del producto (ver la
  // nota de arriba), nunca un costo tipeado por el usuario. Las compras, devoluciones y
  // entradas por ajuste sí manejan un costo real, por eso conservan la etiqueta simple.
  const costHeaderLabel = isPriceBasedType
    ? "Precio unit."
    : usesAvgCostFallback
      ? "Costo unit. (prom.)"
      : "Costo unit.";
  const itemHeaders = showObservaciones
    ? ["Código", "Descripción", "Cantidad", "Observaciones", costHeaderLabel, "Subtotal"]
    : isReservationType
      ? ["Código", "Descripción", "Cantidad", "Liberado", "Pendiente", costHeaderLabel, "Subtotal"]
      : ["Código", "Descripción", "Cantidad", costHeaderLabel, "Subtotal"];
  // Cuántas celdas vacías dejar en el pie de la tabla antes del "Total", para que quede
  // alineado bajo la columna de costo aunque haya columnas extra (Observaciones, o Liberado y Pendiente).
  const footerSkipCols = showObservaciones ? 4 : isReservationType ? 5 : 3;

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={() => navigate("/documents")}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a operaciones
      </button>

      {/* Voided banner */}
      {isVoided && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Esta operación fue anulada. Los movimientos de inventario fueron revertidos.
          </p>
        </div>
      )}

      {/* Header card — borde de acento izquierdo + ícono por tipo (misma paleta que DOC_TYPE_BADGE) */}
      <div
        className={cn(
          "bg-surface rounded-2xl border border-ui-border shadow-sm p-6 border-l-4",
          accentInfo.border,
        )}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                accentInfo.iconBg,
              )}
            >
              <accentInfo.icon className={cn("w-6 h-6", accentInfo.iconText)} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl text-content font-mono">{docNumber}</h1>
                <span
                  className={cn("px-2.5 py-1 rounded-full text-xs font-medium", typeInfo.className)}
                >
                  {typeInfo.label}
                </span>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    statusInfo.className,
                  )}
                >
                  {statusInfo.label}
                </span>
                {pvConvBadge && (
                  <span
                    className={cn(
                      "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                      pvConvBadge.className,
                    )}
                  >
                    {pvConvBadge.label}
                  </span>
                )}
              </div>
              <p className="text-content-muted text-sm mt-1 font-accent">
                Creado por {doc.user.name}
              </p>
              {!isDraft && doc.confirmedBy && (
                <p className="text-content-muted text-sm font-accent">
                  Confirmado por {doc.confirmedBy.name}
                </p>
              )}
              {doc.status === "voided" && doc.voidedBy && (
                <p className="text-content-muted text-sm font-accent">
                  Anulado por {doc.voidedBy.name}
                </p>
              )}
              {doc.updatedBy && (
                <p className="text-content-muted text-sm font-accent">
                  Editado por {doc.updatedBy.name}
                </p>
              )}
              {doc.convertedBy && (
                <p className="text-content-muted text-sm font-accent">
                  Convertido por {doc.convertedBy.name}
                  {doc.convertedAt && ` el ${formatDate(doc.convertedAt)}`}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <>
                <button
                  onClick={() => navigate(`/documents/${doc.id}/edit`)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar
                </button>
              </>
            )}
            {doc.type === "CM" && canDuplicateCM && (
              <button
                onClick={() => doDuplicate()}
                disabled={isDuplicating}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDuplicating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Duplicar
              </button>
            )}
            {isConfirmed && isReservationType && canRelease && (
              <button
                onClick={() => setReleaseOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
              >
                <Unlock className="w-4 h-4" />
                Liberar Stock
              </button>
            )}
            {isConfirmed && isReservationType && canConvert && !pvActiveDerived && (
              // La conversión real ocurre en el checkout de ventas, que se abre precargado con
              // este documento. Se deshabilita solo si ya no queda cantidad pendiente (todo
              // liberado o ya convertido).
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/documents/pos/new?${doc.type === "REM" ? "fromREM" : "fromPV"}=${doc.id}`,
                  )
                }
                disabled={!hasPendingItems(doc)}
                title={
                  hasPendingItems(doc)
                    ? undefined
                    : "Este documento ya no tiene cantidad pendiente por convertir"
                }
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ShoppingCart className="w-4 h-4" />
                Convertir a venta
              </button>
            )}
            {isReservationType && pvActiveDerived && (
              // Ya hay una venta derivada vigente (borrador o confirmada): en vez de anular o
              // convertir, se ofrece ir directo a esa venta. El backend igual lo rechaza si se intenta.
              <button
                type="button"
                onClick={() => navigate(`/documents/${pvActiveDerived.id}`)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                Ver venta {fmtDocRef(pvActiveDerived.type, pvActiveDerived.number)}
              </button>
            )}
            {isConfirmed && (doc.type === "CM" || doc.type === "DVC") && (
              <button
                onClick={() => doPrint()}
                disabled={isPrinting}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Imprimir
              </button>
            )}
            {isConfirmed && !pvActiveDerived && (
              <button
                onClick={() => setVoidOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Anular
              </button>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 border-t border-ui-divide pt-5">
          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint font-accent">Fecha</p>
              <p className="text-sm text-content">{formatDate(doc.date)}</p>
            </div>
          </div>

          {/* Antigüedad — solo mientras la PV sigue abierta (confirmada, sin conversión) */}
          {pvAgeLabel && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">Antigüedad</p>
                <p className="text-sm text-content">{pvAgeLabel}</p>
              </div>
            </div>
          )}

          {/* Third party */}
          {doc.thirdParty && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">
                  {doc.type === "CM" || doc.type === "DVC"
                    ? "Proveedor"
                    : doc.type === "PV" || doc.type === "REM"
                      ? "Cliente"
                      : "Tercero"}
                </p>
                <p className="text-sm text-content">{doc.thirdParty.name}</p>
              </div>
            </div>
          )}

          {/* Seller — preventas (PV) y remisiones (REM) */}
          {isReservationType && doc.seller && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <UserCog className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">Vendedora</p>
                <p className="text-sm text-content">{doc.seller.name}</p>
              </div>
            </div>
          )}

          {/* Warehouse(s) */}
          {doc.type === "T" ? (
            <div className="flex items-start gap-3 col-span-2">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-content-muted" />
              </div>
              <div>
                <p className="text-xs text-content-faint font-accent">Traslado</p>
                <div className="flex items-center gap-2 text-sm text-content">
                  <span>{doc.warehouse?.name ?? "—"}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-content-faint" />
                  <span>{doc.destWarehouse?.name ?? "—"}</span>
                  {doc.destBin && (
                    <span className="text-content-muted">
                      / {doc.destBin.zone.name} / {doc.destBin.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            (doc.warehouse || doc.destWarehouse) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                  <Warehouse className="w-4 h-4 text-content-muted" />
                </div>
                <div>
                  <p className="text-xs text-content-faint font-accent">Bodega</p>
                  <p className="text-sm text-content">
                    {doc.destWarehouse?.name ?? doc.warehouse?.name ?? "—"}
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Notes */}
        {doc.notes && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-surface-raised border border-ui-border">
            <p className="text-xs text-content-faint font-accent mb-1">Notas</p>
            <p className="text-sm text-content-secondary">{doc.notes}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-divide">
          <h2 className="text-base text-content">
            Ítems
            <span className="ml-2 text-sm text-content-faint font-normal">
              ({doc.documentItems.length})
            </span>
          </h2>
        </div>

        {doc.documentItems.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-content-muted text-sm">Sin ítems</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {itemHeaders.map((h) => (
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
                {doc.documentItems.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-content">
                      {item.product.code}
                    </td>
                    <td className="px-5 py-3.5 text-content max-w-[280px]">
                      <span className="truncate block">{item.product.description}</span>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {item.quantity.toLocaleString("es-CO")}
                    </td>
                    {showObservaciones && (
                      <td className="px-5 py-3.5 text-content-muted text-xs max-w-[200px]">
                        <span className="truncate block">{item.observaciones || "—"}</span>
                      </td>
                    )}
                    {isReservationType && (
                      <>
                        <td className="px-5 py-3.5 text-content-muted text-xs">
                          {(item.releasedQuantity ?? 0).toLocaleString("es-CO")}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          {(() => {
                            const pending = getPendingQuantity(item);
                            return (
                              <span className={pending > 0 ? "text-content" : "text-content-faint"}>
                                {pending.toLocaleString("es-CO")}
                              </span>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {itemUnitCost(item) > 0 ? formatCOP(itemUnitCost(item)) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs">
                      {itemSubtotal(item) > 0 ? formatCOP(itemSubtotal(item)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ui-border bg-surface-raised">
                  <td colSpan={footerSkipCols} />
                  <td className="px-5 py-3.5 text-xs font-semibold text-content-faint uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-5 py-3.5 text-sm font-medium text-content-secondary">
                    {formatCOP(itemsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}

      {/* Confirm document */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar operación"
        description={`Al confirmar ${docNumber}, se ejecutarán los movimientos de inventario correspondientes. Esta acción no se puede deshacer directamente (solo anulando la operación después).`}
        confirmLabel="Confirmar operación"
        confirmClass="gradient-action"
        isPending={isConfirming}
        onConfirm={doConfirm}
        onCancel={() => setConfirmOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-action shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
        }
      />

      {/* Void document */}
      <ConfirmDialog
        open={voidOpen}
        title="Anular operación"
        description={`Al anular ${docNumber}, todos los movimientos de inventario generados por esta operación serán revertidos. Esta acción afecta el stock y no se puede deshacer.`}
        confirmLabel="Anular operación"
        confirmClass="bg-red-600 hover:bg-red-700"
        isPending={isVoiding}
        onConfirm={doVoid}
        onCancel={() => setVoidOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        }
      />

      {/* Delete document */}
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar operación"
        description={`¿Estás seguro de eliminar el borrador ${docNumber}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar borrador"
        confirmClass="bg-red-600 hover:bg-red-700"
        isPending={isDeleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteOpen(false)}
        icon={
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
        }
      />

      {/* Release reserved items — preventas (PV) y remisiones (REM) confirmadas */}
      {isReservationType && (
        <ReleaseItemsDialog open={releaseOpen} doc={doc} onClose={() => setReleaseOpen(false)} />
      )}
    </div>
  );
}

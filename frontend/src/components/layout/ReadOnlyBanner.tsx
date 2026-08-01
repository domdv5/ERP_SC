import { Lock } from "lucide-react";
import type { SystemStatusActivatedBy } from "@/types";

interface ReadOnlyBannerProps {
  activatedBy: SystemStatusActivatedBy | null;
  activatedAt: string | null;
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ReadOnlyBanner({ activatedBy, activatedAt }: ReadOnlyBannerProps) {
  return (
    <div className="flex items-center gap-2 px-6 py-2.5 w-full shrink-0 bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400 border-b border-red-500/20">
      <Lock className="w-4 h-4 shrink-0" />
      <p className="text-sm font-medium">
        Modo de solo lectura activo &mdash; cierre contable en curso.
        {activatedBy && <> Activado por {activatedBy.name}</>}
        {activatedAt && <> el {formatDateTime(activatedAt)}</>}
        {(activatedBy || activatedAt) && "."}
      </p>
    </div>
  );
}

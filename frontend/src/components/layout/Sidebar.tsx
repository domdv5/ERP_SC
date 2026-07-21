import { useRef, useState, useEffect } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Store,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  LogOut,
  ChevronUp,
  ShieldCheck,
  Contact,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { usePermission } from "@/hooks/usePermission";
import { getRoleLabel } from "@/services/users.service";
import { getWarehouses } from "@/services/warehouses.service";

function getNavLinkClass(isActive: boolean) {
  return cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
    isActive
      ? "nav-active text-content dark:text-white shadow-lg"
      : "text-content-secondary dark:text-white/60 hover:text-content dark:hover:text-white hover:bg-surface-hover dark:hover:bg-white/5",
  );
}

const topGroups = [
  {
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
];

const bottomGroups = [
  {
    label: "Operaciones",
    items: [
      { to: "/documents", icon: FileText, label: "Operaciones" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { to: "/accounts-receivable", icon: TrendingUp, label: "Cuentas × Cobrar" },
      { to: "/accounts-payable", icon: TrendingDown, label: "Cuentas × Pagar" },
    ],
  },
];

function WarehousesSidebarItem() {
  const location = useLocation();
  const isActive = location.pathname.startsWith("/warehouses");
  const currentId = new URLSearchParams(location.search).get("id");
  const [open, setOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("group w-full", getNavLinkClass(isActive))}
      >
        <Warehouse className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">Bodegas</span>
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      <div
        className="overflow-hidden transition-all ease-in-out"
        style={{ maxHeight: open ? "300px" : "0px", transitionDuration: "200ms" }}
      >
        <div className="ml-3 mt-0.5 mb-1 border-l border-ui-border-medium dark:border-white/10 pl-2 space-y-0.5">
          {warehouses.map((w) => {
            const WIcon = w.type === "store" ? Store : Warehouse;
            const isItemActive = currentId === w.id;
            return (
              <Link
                key={w.id}
                to={`/warehouses?id=${w.id}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  isItemActive
                    ? "text-content dark:text-white bg-brand-secondary/20"
                    : "text-content-muted dark:text-white/50 hover:text-content dark:hover:text-white hover:bg-surface-hover dark:hover:bg-white/5",
                )}
              >
                <WIcon className="w-3 h-3 shrink-0" />
                <span className="truncate">{w.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canManageUsers = usePermission("user.manage");
  const canReadThirdParties = usePermission("thirdparty.read");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    toast.info("Sesión cerrada correctamente");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <aside className="w-64 flex flex-col h-full bg-surface dark:bg-brand-primary border-r border-ui-border-medium dark:border-white/10 shadow-2xl">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-ui-border-medium dark:border-white/10">
        <div className="flex items-center gap-3">
          <img src="/Logo.svg" alt="EloSC" className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-content dark:text-white font-bold text-sm leading-tight tracking-wide">
              EloSC
            </p>
            <p className="text-content-muted dark:text-white/40 text-xs font-accent">Surtidora de Comerciantes</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {/* Dashboard */}
        {topGroups.map((group, i) => (
          <div key={i} className="space-y-0.5">
            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                              </NavLink>
            ))}
          </div>
        ))}

        {/* Maestros */}
        <div className="space-y-0.5">
          <p className="text-content-faint dark:text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
            Maestros
          </p>
          {canReadThirdParties && (
            <NavLink
              to="/third-parties"
              className={({ isActive }) => getNavLinkClass(isActive)}
            >
              <Contact className="w-4 h-4 shrink-0" />
              <span className="flex-1">Terceros</span>
                          </NavLink>
          )}
          <NavLink
            to="/products"
            className={({ isActive }) => getNavLinkClass(isActive)}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span className="flex-1">Productos</span>
                      </NavLink>

          {/* Bodegas — acordeón */}
          <WarehousesSidebarItem />
        </div>

        {/* Operaciones + Finanzas */}
        {bottomGroups.map((group, i) => (
          <div key={i} className="space-y-0.5">
            <p className="text-content-faint dark:text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
              {group.label}
            </p>
            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                              </NavLink>
            ))}
          </div>
        ))}

        {canManageUsers && (
          <div className="space-y-0.5">
            <p className="text-content-faint dark:text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
              Administración
            </p>
            <NavLink
              to="/users"
              className={({ isActive }) => getNavLinkClass(isActive)}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="flex-1">Usuarios</span>
                          </NavLink>
          </div>
        )}
      </nav>

      {/* Footer — user dropdown */}
      <div className="px-3 py-4 border-t border-ui-border-medium dark:border-white/10 relative" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-ui-border-medium dark:border-white/10 shadow-xl overflow-hidden bg-surface dark:bg-brand-surface">
            <div className="px-4 py-3 bg-surface-raised dark:bg-transparent border-b border-ui-border-medium dark:border-white/10">
              <p className="text-content dark:text-white text-xs font-semibold truncate">
                {user?.name ?? "Usuario"}
              </p>
              <p className="text-content-muted dark:text-white/40 text-xs truncate">{user?.username}</p>
              {user?.roles && user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.roles.map((r) => (
                    <span
                      key={r}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-secondary/20 text-brand-secondary"
                    >
                      {getRoleLabel(r)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="p-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-secondary dark:text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}
        <button
          onClick={toggleMenu}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
            menuOpen ? "bg-surface-hover dark:bg-white/10" : "hover:bg-surface-hover dark:hover:bg-white/5",
          )}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-action">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-content dark:text-white text-xs font-medium truncate">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-content-muted dark:text-white/40 text-xs truncate">
              {user?.roles?.map(getRoleLabel).join(", ") ?? user?.username ?? "Sesión activa"}
            </p>
          </div>
          <ChevronUp
            className={cn(
              "w-3 h-3 text-content-faint dark:text-white/30 transition-transform duration-200",
              menuOpen ? "rotate-0" : "rotate-180",
            )}
          />
        </button>
      </div>
    </aside>
  );
}

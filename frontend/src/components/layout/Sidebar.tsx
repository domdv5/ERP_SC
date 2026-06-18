import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
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

const maestrosStaticItems = [
  { to: "/products", icon: Package, label: "Productos" },
  { to: "/warehouses", icon: Warehouse, label: "Bodegas" },
];

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canManageUsers = usePermission('user.manage');
  const canReadThirdParties = usePermission('thirdparty.read');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    toast.info("Sesión cerrada correctamente");
    navigate("/login", { replace: true });
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
      document.removeEventListener("mousedown", handleClickOutside);
    }
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => {
      if (!prev) document.addEventListener("mousedown", handleClickOutside);
      return !prev;
    });
  };

  return (
    <aside className="w-64 flex flex-col h-full bg-brand-primary shadow-2xl">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/Logo.svg" alt="EloSC" className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">
              EloSC
            </p>
            <p className="text-white/40 text-xs font-accent">Surtidora de Comerciantes</p>
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
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "nav-active text-white shadow-lg"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            ))}
          </div>
        ))}

        {/* Maestros — Terceros only visible when user has thirdparty.read */}
        <div className="space-y-0.5">
          <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
            Maestros
          </p>
          {canReadThirdParties && (
            <NavLink
              to="/third-parties"
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "nav-active text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                )
              }
            >
              <Contact className="w-4 h-4 shrink-0" />
              <span className="flex-1">Terceros</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          )}
          {maestrosStaticItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "nav-active text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </div>

        {/* Operaciones + Finanzas */}
        {bottomGroups.map((group, i) => (
          <div key={i} className="space-y-0.5">
            <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
              {group.label}
            </p>
            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "nav-active text-white shadow-lg"
                      : "text-white/60 hover:text-white hover:bg-white/5",
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            ))}
          </div>
        ))}

        {canManageUsers && (
          <div className="space-y-0.5">
            <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
              Administración
            </p>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "nav-active text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                )
              }
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="flex-1">Usuarios</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          </div>
        )}
      </nav>

      {/* Footer — user dropdown */}
      <div
        className="px-3 py-4 border-t border-white/10 relative"
        ref={menuRef}
      >
        {/* Dropdown menu — opens upward */}
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-brand-surface">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-white text-xs font-semibold truncate">
                {user?.name ?? "Usuario"}
              </p>
              <p className="text-white/40 text-xs truncate">{user?.username}</p>
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}

        {/* Trigger */}
        <button
          onClick={toggleMenu}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
            menuOpen ? "bg-white/10" : "hover:bg-white/5",
          )}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-action">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-xs font-medium truncate">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-white/40 text-xs truncate">
              {user?.roles?.map(getRoleLabel).join(", ") ?? user?.username ?? "Sesión activa"}
            </p>
          </div>
          <ChevronUp
            className={cn(
              "w-3 h-3 text-white/30 transition-transform duration-200",
              menuOpen ? "rotate-0" : "rotate-180",
            )}
          />
        </button>
      </div>
    </aside>
  );
}

import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";

const navGroups = [
  {
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Maestros",
    items: [
      { to: "/third-parties", icon: Users, label: "Terceros" },
      { to: "/products", icon: Package, label: "Productos" },
      { to: "/warehouses", icon: Warehouse, label: "Bodegas" },
    ],
  },
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

export function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
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
        {navGroups.map((group, i) => (
          <div key={i} className="space-y-0.5">
            {group.label && (
              <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest px-3 pb-1">
                {group.label}
              </p>
            )}
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
              {user?.username ?? "Sesión activa"}
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

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { login } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

const schema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: LoginForm) => login(data.username, data.password),
    onSuccess: ({ user, token }) => {
      setAuth(user, token);
      toast.success(`Bienvenido, ${user.name}`);
      navigate("/dashboard");
    },
    onError: () => {
      toast.error("Usuario o contraseña incorrectos");
    },
  });

  return (
    <div className="min-h-screen flex bg-brand-primary-dark">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-brand-primary">
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #07bc34, transparent)" }}
        />
        <div
          className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #07bc34, transparent)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #07bc34, transparent)" }}
        />

        <div className="relative flex items-center gap-3">
          <img
            src="/Logo.svg"
            alt="EloSC"
            className="w-10 h-10 rounded-xl object-cover shadow-2xl shrink-0"
          />
          <span className="text-white font-bold text-xl tracking-wide">EloSC</span>
        </div>

        <div className="relative">
          <h1 className="text-5xl text-white leading-tight mb-4">
            Gestión inteligente
            <br />
            <span className="text-gradient-brand">de tu cadena</span>
          </h1>
          <p className="text-white/50 text-lg font-accent">
            Inventario, documentos, clientes y más desde una sola plataforma.
          </p>
        </div>

        <p className="relative text-white/20 text-sm">© 2026 EloSC</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl text-white mb-1">Iniciar sesión</h2>
              <p className="text-white/40 text-sm font-accent">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            <form
              onSubmit={handleSubmit((d) => mutate(d))}
              className="space-y-5"
            >
              <div>
                <label className="block text-white/70 text-sm font-medium mb-1.5">
                  Usuario
                </label>
                <input
                  {...register("username")}
                  type="text"
                  placeholder="tu.usuario"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 border border-white/10 bg-white/[0.07] focus:outline-none focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20 transition-colors text-sm"
                />
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-white/70 text-sm font-medium mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl text-white placeholder-white/20 border border-white/10 bg-white/[0.07] focus:outline-none focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/20 transition-colors text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2 gradient-action"
              >
                {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

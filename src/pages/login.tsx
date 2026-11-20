import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineEnvelope, HiOutlineEye, HiOutlineEyeSlash, HiOutlineLockClosed } from "react-icons/hi2";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { useAuth } from "@/lib/auth";
import { AuthShell, authInput } from "./auth-shell";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      nav((loc.state as { from?: string } | null)?.from ?? "/", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresa con tu correo y contraseña.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/60">Correo</span>
          <div className="relative">
            <HiOutlineEnvelope className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40" />
            <input
              type="email"
              required
              autoComplete="email"
              className={authInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-white/60">Contraseña</span>
          <div className="relative">
            <HiOutlineLockClosed className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40" />
            <input
              type={show ? "text" : "password"}
              required
              autoComplete="current-password"
              className={authInput + " pr-10"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {show ? <HiOutlineEyeSlash className="size-4" /> : <HiOutlineEye className="size-4" />}
            </button>
          </div>
        </label>
        <ShimmerButton type="submit" disabled={busy} className="mt-2 h-11 w-full">
          {busy ? "Entrando…" : "Entrar"}
        </ShimmerButton>
      </form>
      <p className="mt-6 text-center text-sm text-white/55">
        ¿No tienes cuenta?{" "}
        <Link to="/registro" className="font-medium text-orange-300 hover:underline">
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}

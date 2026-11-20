import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineEnvelope, HiOutlineLockClosed, HiOutlineUser } from "react-icons/hi2";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { useAuth } from "@/lib/auth";
import { AuthShell, authInput } from "./auth-shell";

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ nombre: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (f.password !== f.confirm) return toast.error("Las contraseñas no coinciden");
    setBusy(true);
    try {
      await register(f.nombre, f.email, f.password);
      toast.success("¡Cuenta creada!");
      nav("/", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fields = [
    { k: "nombre", label: "Nombre completo", type: "text", icon: HiOutlineUser, ac: "name", ph: "María Pérez" },
    { k: "email", label: "Correo", type: "email", icon: HiOutlineEnvelope, ac: "email", ph: "tu@correo.com" },
    { k: "password", label: "Contraseña", type: "password", icon: HiOutlineLockClosed, ac: "new-password", ph: "Mínimo 8 caracteres" },
    { k: "confirm", label: "Repite la contraseña", type: "password", icon: HiOutlineLockClosed, ac: "new-password", ph: "••••••••" },
  ] as const;

  return (
    <AuthShell title="Crear cuenta" subtitle="El primer usuario registrado será el administrador.">
      <form onSubmit={submit} className="space-y-4">
        {fields.map(({ k, label, type, icon: Icon, ac, ph }) => (
          <label key={k} className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
            <div className="relative">
              <Icon className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40" />
              <input type={type} required autoComplete={ac} className={authInput} value={f[k]} onChange={set(k)} placeholder={ph} />
            </div>
          </label>
        ))}
        <ShimmerButton type="submit" disabled={busy} className="mt-2 h-11 w-full">
          {busy ? "Creando cuenta…" : "Registrarme"}
        </ShimmerButton>
      </form>
      <p className="mt-6 text-center text-sm text-white/55">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-orange-300 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}

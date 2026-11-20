import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtFechaHora } from "@/lib/format";
import type { Usuario } from "@/lib/types";
import { PageHeader } from "./app-layout";

export function PerfilPage() {
  const { user, setUser } = useAuth();
  const [nombre, setNombre] = useState(user?.nombre ?? "");
  const [pw, setPw] = useState({ actual: "", nueva: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const save = async (body: Record<string, string>, ok: string) => {
    setBusy(true);
    try {
      const r = await api<{ user: Usuario }>("/auth/me", { method: "PUT", json: body });
      setUser(r.user);
      toast.success(ok);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  return (
    <>
      <PageHeader title="Mi perfil" subtitle={`${user.email} · ${user.rol} · miembro desde ${fmtFechaHora(user.created_at)}`} />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ nombre }, "Nombre actualizado");
          }}
        >
          <h2 className="font-semibold">Datos</h2>
          <label className="block">
            <span className="field-label">Nombre</span>
            <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={2} required />
          </label>
          <label className="block">
            <span className="field-label">Correo</span>
            <input className="field-input" value={user.email} disabled />
          </label>
          <button className="btn-primary" disabled={busy}>
            Guardar
          </button>
        </form>
        <form
          className="card space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.nueva !== pw.confirm) return toast.error("Las contraseñas no coinciden");
            if (await save({ password_actual: pw.actual, password_nueva: pw.nueva }, "Contraseña actualizada"))
              setPw({ actual: "", nueva: "", confirm: "" });
          }}
        >
          <h2 className="font-semibold">Cambiar contraseña</h2>
          {(
            [
              ["actual", "Contraseña actual", "current-password"],
              ["nueva", "Nueva contraseña", "new-password"],
              ["confirm", "Repite la nueva", "new-password"],
            ] as const
          ).map(([k, l, ac]) => (
            <label key={k} className="block">
              <span className="field-label">{l}</span>
              <input
                type="password"
                className="field-input"
                required
                minLength={k === "actual" ? 1 : 8}
                autoComplete={ac}
                value={pw[k]}
                onChange={(e) => setPw({ ...pw, [k]: e.target.value })}
              />
            </label>
          ))}
          <button className="btn-primary" disabled={busy}>
            Actualizar contraseña
          </button>
        </form>
      </div>
    </>
  );
}

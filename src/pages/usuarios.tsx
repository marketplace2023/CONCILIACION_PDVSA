import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HiOutlineKey, HiOutlineMapPin, HiOutlinePlus, HiOutlineTrash, HiOutlineUserPlus } from "react-icons/hi2";
import { Modal } from "@/components/modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtFechaHora } from "@/lib/format";
import { useEstaciones } from "@/lib/hooks";
import type { Usuario } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "./app-layout";

type Tab = "usuarios" | "estaciones" | "actividad";

export function UsuariosPage() {
  const [tab, setTab] = useState<Tab>("usuarios");
  return (
    <>
      <PageHeader title="Administración" subtitle="Usuarios del sistema, estaciones de servicio y bitácora de actividad." />
      <div className="mb-5 inline-flex rounded-xl border bg-muted/50 p-1">
        {(["usuarios", "estaciones", "actividad"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("relative rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition", tab === t ? "text-foreground" : "text-muted-foreground")}
          >
            {tab === t && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-lg bg-background shadow-sm" />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "estaciones" && <EstacionesTab />}
      {tab === "actividad" && <ActividadTab />}
    </>
  );
}

function UsuariosTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<Usuario[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [pwd, setPwd] = useState<Usuario | null>(null);
  const [del, setDel] = useState<Usuario | null>(null);

  const load = useCallback(() => api<Usuario[]>("/usuarios").then(setUsers).catch((e) => toast.error(e.message)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (u: Usuario, body: Record<string, unknown>, msg: string) => {
    try {
      await api(`/usuarios/${u.id}`, { method: "PATCH", json: body });
      toast.success(msg);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={() => setNuevo(true)}>
          <HiOutlineUserPlus /> Nuevo usuario
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {users.map((u) => (
          <div key={u.id} className={cn("card p-4", !u.activo && "opacity-60")}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-foreground">
                {u.nombre[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {u.nombre} {u.id === me?.id && <span className="text-xs text-muted-foreground">(tú)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {u.registros ?? 0} registros · último acceso {fmtFechaHora(u.ultimo_acceso)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
              <select
                className="field-input h-8 w-auto py-0 text-xs"
                value={u.rol}
                disabled={u.id === me?.id}
                onChange={(e) => patch(u, { rol: e.target.value }, "Rol actualizado")}
              >
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={!!u.activo}
                  disabled={u.id === me?.id}
                  onChange={(e) => patch(u, { activo: e.target.checked }, e.target.checked ? "Usuario activado" : "Usuario desactivado")}
                />
                Activo
              </label>
              <span className="flex-1" />
              <button className="btn-icon" title="Cambiar contraseña" onClick={() => setPwd(u)}>
                <HiOutlineKey />
              </button>
              {u.id !== me?.id && (
                <button className="btn-icon hover:text-destructive" title="Eliminar" onClick={() => setDel(u)}>
                  <HiOutlineTrash />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <NuevoUsuario open={nuevo} onClose={() => setNuevo(false)} onDone={load} />

      <Modal open={!!pwd} onClose={() => setPwd(null)} title={`Nueva contraseña para ${pwd?.nombre}`} size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = new FormData(e.currentTarget).get("p") as string;
            if (pwd) void patch(pwd, { password: p }, "Contraseña actualizada").then(() => setPwd(null));
          }}
        >
          <input name="p" type="password" minLength={8} required className="field-input" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          <div className="mt-4 flex justify-end">
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Eliminar usuario" size="sm">
        <p className="text-sm">
          ¿Eliminar a <b>{del?.nombre}</b>? Sus registros se conservan. Si solo quieres bloquear el acceso, desactívalo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setDel(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              try {
                await api(`/usuarios/${del!.id}`, { method: "DELETE" });
                toast.success("Usuario eliminado");
                setDel(null);
                void load();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </>
  );
}

function NuevoUsuario({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ nombre: "", email: "", password: "", rol: "operador" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/usuarios", { method: "POST", json: f });
      toast.success("Usuario creado");
      setF({ nombre: "", email: "", password: "", rol: "operador" });
      onClose();
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nuevo usuario" size="sm">
      <form onSubmit={submit} className="space-y-3">
        {(
          [
            ["nombre", "Nombre", "text"],
            ["email", "Correo", "email"],
            ["password", "Contraseña inicial", "password"],
          ] as const
        ).map(([k, l, t]) => (
          <label key={k} className="block">
            <span className="field-label">{l}</span>
            <input
              type={t}
              required
              minLength={k === "password" ? 8 : undefined}
              className="field-input"
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              autoComplete={k === "password" ? "new-password" : "off"}
            />
          </label>
        ))}
        <label className="block">
          <span className="field-label">Rol</span>
          <select className="field-input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
            <option value="operador">Operador (carga y consulta registros)</option>
            <option value="admin">Administrador (además gestiona usuarios)</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy}>
            Crear usuario
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EstacionesTab() {
  const { estaciones, reload } = useEstaciones();
  const [f, setF] = useState({ nombre: "", codigo: "509002", alias: "" });
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/estaciones", { method: "POST", json: f });
      setF({ nombre: "", codigo: "509002", alias: "" });
      await reload();
      toast.success("Estación agregada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="card divide-y">
        {estaciones.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3">
            <HiOutlineMapPin className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{e.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">
                Código {e.codigo} · reconoce: {e.alias || e.nombre.toUpperCase()}
              </p>
            </div>
            <button
              className="btn-icon hover:text-destructive"
              title="Eliminar"
              onClick={async () => {
                await api(`/estaciones/${e.id}`, { method: "DELETE" });
                await reload();
              }}
            >
              <HiOutlineTrash />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="card h-fit space-y-3 p-4">
        <p className="font-medium">Agregar estación</p>
        <input className="field-input" required placeholder="Nombre (ej. Ejido)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <input className="field-input" placeholder="Código cliente" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
        <input
          className="field-input"
          placeholder="Palabras clave OCR, separadas por coma"
          value={f.alias}
          onChange={(e) => setF({ ...f, alias: e.target.value })}
        />
        <button className="btn-primary w-full">
          <HiOutlinePlus /> Agregar
        </button>
      </form>
    </div>
  );
}

const ACCIONES: Record<string, string> = {
  login: "Inició sesión",
  registro: "Se registró",
  crear_registro: "Creó registro",
  editar_registro: "Editó registro",
  eliminar_registro: "Eliminó registro",
  exportar_excel: "Exportó Excel",
  crear_usuario: "Creó usuario",
  editar_usuario: "Editó usuario",
  eliminar_usuario: "Eliminó usuario",
};

function ActividadTab() {
  const [rows, setRows] = useState<Array<{ id: number; nombre: string | null; accion: string; detalle: string | null; created_at: string }>>([]);
  useEffect(() => {
    api<typeof rows>("/actividad").then(setRows).catch((e) => toast.error(e.message));
  }, []);
  return (
    <div className="card divide-y">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
          <span>
            <b>{r.nombre ?? "—"}</b> {ACCIONES[r.accion] ?? r.accion}
            {r.detalle && <span className="tabular text-muted-foreground"> · {r.detalle}</span>}
          </span>
          <span className="text-xs text-muted-foreground">{fmtFechaHora(r.created_at)}</span>
        </div>
      ))}
      {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">Sin actividad.</p>}
    </div>
  );
}

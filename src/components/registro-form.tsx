import type { ReactNode } from "react";
import { HiOutlineSparkles } from "react-icons/hi2";
import { cn } from "@/lib/utils";
import type { Estacion, RegistroDraft } from "@/lib/types";

function Field({
  label,
  children,
  error,
  auto,
  className,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  auto?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="field-label flex items-center gap-1">
        {label}
        {auto && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-accent-foreground">
            <HiOutlineSparkles className="size-3" /> OCR
          </span>
        )}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-destructive">{error}</span>}
    </label>
  );
}

export function RegistroForm({
  value,
  onChange,
  estaciones,
  autoFields,
  errors = {},
}: {
  value: RegistroDraft;
  onChange: (v: RegistroDraft) => void;
  estaciones: Estacion[];
  autoFields?: Set<string>;
  errors?: Partial<Record<keyof RegistroDraft, string>>;
}) {
  const set = (k: keyof RegistroDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const cls = (k: keyof RegistroDraft) =>
    cn("field-input", autoFields?.has(k) && "border-primary/40 bg-accent/30", errors[k] && "border-destructive");

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Factura</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="N° Factura *" error={errors.nro_factura} auto={autoFields?.has("nro_factura")}>
            <input className={cls("nro_factura")} inputMode="numeric" value={value.nro_factura} onChange={set("nro_factura")} placeholder="321049798" />
          </Field>
          <Field label="Fecha de emisión *" error={errors.fecha_emision} auto={autoFields?.has("fecha_emision")}>
            <input type="date" className={cls("fecha_emision")} value={value.fecha_emision} onChange={set("fecha_emision")} />
          </Field>
          <Field label="Estación de servicio *" error={errors.estacion} auto={autoFields?.has("estacion")}>
            <input
              className={cls("estacion")}
              list="estaciones-list"
              value={value.estacion}
              onChange={set("estacion")}
              placeholder="Selecciona o escribe"
            />
            <datalist id="estaciones-list">
              {estaciones.map((e) => (
                <option key={e.id} value={e.nombre} />
              ))}
            </datalist>
          </Field>
          <Field label="Código" auto={autoFields?.has("codigo")}>
            <input className={cls("codigo")} inputMode="numeric" value={value.codigo} onChange={set("codigo")} />
          </Field>
          <Field label="N° de control" auto={autoFields?.has("nro_control")}>
            <input className={cls("nro_control")} value={value.nro_control} onChange={set("nro_control")} placeholder="00-18812889" />
          </Field>
          <Field label="Total factura (Bs.)" auto={autoFields?.has("total_factura")}>
            <input className={cls("total_factura")} inputMode="decimal" value={value.total_factura} onChange={set("total_factura")} placeholder="5304400.32" />
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pago</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Pago Bs." error={errors.pago_bs} auto={autoFields?.has("pago_bs")}>
            <input className={cls("pago_bs")} inputMode="decimal" value={value.pago_bs} onChange={set("pago_bs")} placeholder="5304400.32" />
          </Field>
          <Field label="Fecha de pago" auto={autoFields?.has("fecha_pago")}>
            <input type="date" className={cls("fecha_pago")} value={value.fecha_pago} onChange={set("fecha_pago")} />
          </Field>
          <Field label="Referencia de pago" error={errors.referencia} auto={autoFields?.has("referencia")}>
            <input className={cls("referencia")} inputMode="numeric" value={value.referencia} onChange={set("referencia")} placeholder="112134782" />
          </Field>
        </div>
        {value.total_factura && value.pago_bs && Math.abs(Number(value.total_factura) - Number(value.pago_bs)) > 0.009 && (
          <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-foreground">
            El pago ({Number(value.pago_bs).toLocaleString("es-VE")}) no coincide con el total de la factura (
            {Number(value.total_factura).toLocaleString("es-VE")}). Explícalo en observaciones si es un pago parcial.
          </p>
        )}
      </fieldset>

      <Field label="Observaciones">
        <textarea
          className="field-input h-auto min-h-20 py-2"
          value={value.observaciones}
          onChange={set("observaciones")}
          placeholder="Ej.: pago parcial, abono de factura anterior…"
        />
      </Field>
    </div>
  );
}

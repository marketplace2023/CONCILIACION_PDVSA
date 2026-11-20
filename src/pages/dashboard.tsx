import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  HiArrowRight,
  HiOutlineBanknotes,
  HiOutlineCamera,
  HiOutlineClock,
  HiOutlineDocumentArrowUp,
  HiOutlineDocumentText,
  HiOutlineTableCells,
} from "react-icons/hi2";
import { PiMicrosoftExcelLogo } from "react-icons/pi";
import { toast } from "sonner";
import { BackgroundGradient } from "@/components/aceternity/background-gradient";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BorderBeam } from "@/components/magicui/border-beam";
import { MagicCard } from "@/components/magicui/magic-card";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { api, download } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtBs, fmtFecha, fmtFechaHora } from "@/lib/format";
import type { Registro } from "@/lib/types";
import { PageHeader } from "./app-layout";

interface Stats {
  resumen: { total: number; pagado: number; pendientes: number; facturas: number; hoy: number };
  porEstacion: Array<{ estacion: string; registros: number; pagado: number }>;
  porMes: Array<{ mes: string; pagado: number; registros: number }>;
  recientes: Registro[];
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function Stat({ icon, label, children, hint, beam }: { icon: ReactNode; label: string; children: ReactNode; hint?: string; beam?: boolean }) {
  return (
    <MagicCard className="h-full border-0 shadow-sm">
      <div className="relative h-full overflow-hidden rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-lg text-accent-foreground">{icon}</span>
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{children}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        {beam && <BorderBeam size={90} duration={9} />}
      </div>
    </MagicCard>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/registros/stats")
      .then(setS)
      .catch((e) => toast.error(e.message));
  }, []);

  const maxEst = Math.max(1, ...(s?.porEstacion.map((e) => e.pagado) ?? [1]));
  const maxMes = Math.max(1, ...(s?.porMes.map((e) => e.pagado) ?? [1]));

  return (
    <>
      <PageHeader
        title={`Hola, ${user?.nombre.split(" ")[0]} 👋`}
        subtitle="Resumen de la conciliación de pagos a PDVSA."
        actions={
          <button
            className="btn-outline"
            onClick={() => download("/registros/export.xlsx", "conciliacion.xlsx").catch((e) => toast.error(e.message))}
          >
            <PiMicrosoftExcelLogo className="text-green-600" /> Descargar Excel
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          <Stat key="a" icon={<HiOutlineBanknotes />} label="Total pagado" hint="Bolívares" beam>
            <span className="text-xl sm:text-2xl lg:text-[1.65rem]">
              <NumberTicker value={s?.resumen.pagado ?? 0} decimalPlaces={2} />
            </span>
          </Stat>,
          <Stat key="b" icon={<HiOutlineDocumentText />} label="Facturas" hint={`${s?.resumen.total ?? 0} registros de pago`}>
            <NumberTicker value={s?.resumen.facturas ?? 0} />
          </Stat>,
          <Stat key="c" icon={<HiOutlineClock />} label="Pendientes" hint="Sin pago o referencia">
            <NumberTicker value={s?.resumen.pendientes ?? 0} className={s?.resumen.pendientes ? "text-warning" : ""} />
          </Stat>,
          <Stat key="d" icon={<HiOutlineCamera />} label="Cargados hoy">
            <NumberTicker value={s?.resumen.hoy ?? 0} />
          </Stat>,
        ].map((el, i) => (
          <BlurFade key={i} delay={i * 0.06}>
            {el}
          </BlurFade>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <BlurFade delay={0.2} className="lg:col-span-1">
          <BackgroundGradient className="rounded-[22px] bg-card p-6" containerClassName="h-full rounded-3xl">
            <h3 className="text-lg font-semibold">Cargar una factura</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Toma una foto de la factura PDVSA y del comprobante de pago. El sistema lee los datos y los guarda.
            </p>
            <div className="mt-5 grid gap-2">
              <Link to="/escanear" className="btn-primary h-11 justify-between">
                <span className="flex items-center gap-2">
                  <HiOutlineCamera /> Escanear con cámara / foto
                </span>
                <HiArrowRight />
              </Link>
              <Link to="/importar" className="btn-outline h-11 justify-between">
                <span className="flex items-center gap-2">
                  <HiOutlineDocumentArrowUp /> Importar PDF de estación
                </span>
                <HiArrowRight />
              </Link>
            </div>
          </BackgroundGradient>
        </BlurFade>

        <BlurFade delay={0.25} className="lg:col-span-2">
          <div className="card h-full p-5">
            <h3 className="font-semibold">Pagado por estación</h3>
            <div className="mt-4 space-y-3">
              {s?.porEstacion.length ? (
                s.porEstacion.map((e) => (
                  <div key={e.estacion}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{e.estacion}</span>
                      <span className="tabular text-xs text-muted-foreground">
                        {fmtBs(e.pagado)} · {e.registros} reg.
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-[width] duration-700"
                        style={{ width: `${(e.pagado / maxEst) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <Empty />
              )}
            </div>
          </div>
        </BlurFade>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <BlurFade delay={0.3}>
          <div className="card h-full p-5">
            <h3 className="font-semibold">Pagos por mes</h3>
            {s?.porMes.length ? (
              <div className="mt-6 flex h-44 gap-3">
                {s.porMes.map((m) => {
                  const [y, mm] = m.mes.split("-");
                  return (
                    <div key={m.mes} className="group flex flex-1 flex-col items-center gap-2">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-primary/70 to-orange-400 transition-all group-hover:opacity-80"
                          style={{ height: `${Math.max(4, (m.pagado / maxMes) * 100)}%` }}
                          title={fmtBs(m.pagado)}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {MESES[+mm - 1]} {y.slice(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty />
            )}
          </div>
        </BlurFade>

        <BlurFade delay={0.35} className="lg:col-span-2">
          <div className="card h-full p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Últimos registros</h3>
              <Link to="/registros" className="btn-ghost btn-sm">
                <HiOutlineTableCells /> Ver todos
              </Link>
            </div>
            <ul className="mt-3 divide-y">
              {s?.recientes.length ? (
                s.recientes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.estacion ?? "—"} · <span className="tabular">{r.nro_factura}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Emitida {fmtFecha(r.fecha_emision)} · por {r.creado_por ?? "—"} · {fmtFechaHora(r.created_at)}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium">{r.pago_bs ? fmtBs(r.pago_bs) : <span className="text-warning">Pendiente</span>}</span>
                  </li>
                ))
              ) : (
                <Empty />
              )}
            </ul>
          </div>
        </BlurFade>
      </div>
    </>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay datos. Escanea o importa una factura.</p>;
}

import type { ReactNode } from "react";
import { BsFuelPump } from "react-icons/bs";
import { HiOutlineCamera, HiOutlineCloudArrowDown, HiOutlineShieldCheck } from "react-icons/hi2";
import { Spotlight } from "@/components/aceternity/spotlight";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { BlurFade } from "@/components/magicui/blur-fade";
import { BorderBeam } from "@/components/magicui/border-beam";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: <HiOutlineCamera />, title: "Escanea con la cámara", text: "Foto de la factura y del comprobante: los datos se leen solos." },
  { icon: <HiOutlineCloudArrowDown />, title: "Excel en un clic", text: "Descarga la conciliación con el formato oficial." },
  { icon: <HiOutlineShieldCheck />, title: "Acceso por usuario", text: "Cada registro queda firmado por quien lo cargó." },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-svh overflow-hidden bg-neutral-950 text-white lg:grid-cols-[1.1fr_1fr]">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="oklch(0.7 0.2 30)" />
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.12}
        duration={3}
        className={cn(
          "fill-red-500/30 stroke-white/[0.06] [mask-image:radial-gradient(700px_circle_at_30%_40%,white,transparent)]",
          "inset-x-0 h-full skew-y-6",
        )}
      />

      <section className="relative z-10 hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 shadow-lg shadow-red-600/30">
            <BsFuelPump className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Conciliación PDVSA</p>
            <p className="text-xs text-white/50">Estaciones de Servicio CORPOMÉRIDA</p>
          </div>
        </div>
        <div>
          <BlurFade delay={0.1}>
            <h2 className="max-w-lg bg-gradient-to-b from-white to-white/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">
              Facturas y pagos conciliados, sin transcribir a mano.
            </h2>
          </BlurFade>
          <div className="mt-10 grid max-w-lg gap-5">
            {FEATURES.map((f, i) => (
              <BlurFade key={f.title} delay={0.25 + i * 0.1}>
                <div className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg text-orange-300">
                    {f.icon}
                  </span>
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <p className="text-sm text-white/55">{f.text}</p>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/35">© {new Date().getFullYear()} Corporación para la Protección del Pueblo del Estado Mérida</p>
      </section>

      <section className="relative z-10 flex items-center justify-center px-4 py-10 sm:px-8">
        <BlurFade className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-red-600 to-orange-500">
              <BsFuelPump className="size-5" />
            </span>
            <p className="font-semibold">Conciliación PDVSA</p>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-white/55">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <BorderBeam size={180} duration={10} />
          </div>
        </BlurFade>
      </section>
    </div>
  );
}

export const authInput =
  "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 pl-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-orange-400/60 focus:ring-3 focus:ring-orange-400/20";

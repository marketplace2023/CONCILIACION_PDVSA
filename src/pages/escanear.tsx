import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  HiCheckCircle,
  HiOutlineArrowPath,
  HiOutlineBanknotes,
  HiOutlineCodeBracket,
  HiOutlineCpuChip,
  HiOutlineDocumentText,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { TbScan } from "react-icons/tb";
import { FileUpload } from "@/components/aceternity/file-upload";
import { CameraCapture } from "@/components/camera-capture";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Modal } from "@/components/modal";
import { RegistroForm } from "@/components/registro-form";
import { draftToFormData, validarDraft } from "@/lib/registro";
import { api, ApiError } from "@/lib/api";
import { fmtBs, fmtFecha } from "@/lib/format";
import { useEstaciones, useOcrStatus } from "@/lib/hooks";
import { compressImage, leerDocumentos, type Motor } from "@/lib/ocr";
import { emptyDraft, type Registro, type RegistroDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "./app-layout";

type Slot = "factura" | "comprobante";

function usePreview(file: File | null) {
  const url = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

const AUTO_KEY = "conciliacion.autosave";

export function EscanearPage() {
  const { estaciones } = useEstaciones();
  const claudeOk = useOcrStatus();
  const [files, setFiles] = useState<Record<Slot, File | null>>({ factura: null, comprobante: null });
  const [camera, setCamera] = useState<Slot | null>(null);
  const [motorSel, setMotor] = useState<Motor | null>(null);
  const motor: Motor = motorSel ?? (claudeOk ? "claude" : "tesseract");
  const [autoSave, setAutoSave] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [draft, setDraft] = useState<RegistroDraft>(emptyDraft);
  const [autoFields, setAutoFields] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState<{ msg: string; p?: number } | null>(null);
  const [crudo, setCrudo] = useState("");
  const [showCrudo, setShowCrudo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<Registro | null>(null);
  const [ultimo, setUltimo] = useState<Registro | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const runId = useRef(0);

  const facPrev = usePreview(files.factura);
  const compPrev = usePreview(files.comprobante);
  const errors = useMemo(() => (submitted ? validarDraft(draft) : {}), [submitted, draft]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_KEY, autoSave ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [autoSave]);

  const reset = () => {
    setFiles({ factura: null, comprobante: null });
    setDraft(emptyDraft());
    setAutoFields(new Set());
    setCrudo("");
    setSubmitted(false);
  };

  const guardar = async (d: RegistroDraft, f: Record<Slot, File | null>, forzar = false) => {
    const errs = validarDraft(d);
    setSubmitted(true);
    if (Object.keys(errs).length) {
      toast.error("Revisa los campos marcados antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const prep = async (file: File | null) =>
        file ? (file.type === "application/pdf" ? file : await compressImage(file)) : undefined;
      const fd = draftToFormData(d, {
        factura: await prep(f.factura),
        comprobante: await prep(f.comprobante),
        origen: f.factura || f.comprobante ? "ocr" : "manual",
        forzar: forzar ? "true" : undefined,
      });
      const r = await api<Registro>("/registros", { method: "POST", body: fd });
      setUltimo(r);
      setDup(null);
      toast.success(`Factura ${r.nro_factura} guardada`, { description: r.estacion ?? undefined });
      reset();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setDup(e.data.duplicado as Registro);
      else toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const leer = async (f: Record<Slot, File | null> = files, m: Motor = motor) => {
    if (!f.factura && !f.comprobante) return toast.info("Sube primero la foto de la factura o del comprobante");
    const id = ++runId.current;
    setReading({ msg: "Preparando…" });
    try {
      const r = await leerDocumentos({ factura: f.factura, comprobante: f.comprobante, motor: m, estaciones }, (msg, p) =>
        id === runId.current ? setReading({ msg, p }) : undefined,
      );
      if (id !== runId.current) return;
      const found = Object.entries(r.datos).filter(([, v]) => v) as [keyof RegistroDraft, string][];
      const next = { ...draft };
      for (const [k, v] of found) next[k] = v;
      setDraft(next);
      setAutoFields(new Set(found.map(([k]) => k)));
      setCrudo(r.textoCrudo);
      const motorTxt = r.motor === "claude" ? "IA" : r.motor === "pdf-texto" ? "texto del PDF" : "OCR";
      if (!found.length) {
        toast.warning("No se pudieron leer datos. Intenta con una foto más nítida o llena el formulario.");
        return;
      }
      toast.success(`${found.length} campos leídos con ${motorTxt}`);
      // Guardado automático: solo cuando ya tenemos datos de factura y de pago válidos.
      if (autoSave && next.referencia && !Object.keys(validarDraft(next)).length) await guardar(next, f);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof ApiError ? e.message : "Error leyendo el documento");
    } finally {
      if (id === runId.current) setReading(null);
    }
  };

  const setFile = (slot: Slot, file: File | null) => {
    const next = { ...files, [slot]: file };
    setFiles(next);
    if (file) void leer(next);
  };

  return (
    <>
      <PageHeader
        title="Escanear factura"
        subtitle="Toma o sube la foto de la factura PDVSA y del comprobante de pago. Los datos se leen automáticamente."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* --- Documentos --- */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <FileUpload
              title="Factura PDVSA"
              icon={<HiOutlineDocumentText className="text-primary" />}
              hint="Foto, imagen o PDF"
              file={files.factura}
              previewUrl={facPrev}
              onChange={(f) => setFile("factura", f)}
              onCamera={() => setCamera("factura")}
              scanning={!!reading}
            />
            <FileUpload
              title="Comprobante de pago"
              icon={<HiOutlineBanknotes className="text-primary" />}
              hint="Banco del Tesoro (foto o PDF)"
              file={files.comprobante}
              previewUrl={compPrev}
              onChange={(f) => setFile("comprobante", f)}
              onCamera={() => setCamera("comprobante")}
              scanning={!!reading}
            />
          </div>

          <div className="card space-y-4 p-4">
            <div>
              <p className="field-label">Motor de lectura</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "claude", label: "IA (Claude)", icon: <HiOutlineSparkles />, disabled: !claudeOk, note: claudeOk ? "Más precisa" : "No configurada" },
                    { id: "tesseract", label: "OCR local", icon: <HiOutlineCpuChip />, disabled: false, note: "Tesseract, sin costo" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={o.disabled}
                    onClick={() => setMotor(o.id)}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                      motor === o.id ? "border-primary bg-accent/50 ring-2 ring-primary/20" : "hover:border-primary/40",
                    )}
                  >
                    <span className="mt-0.5 text-primary">{o.icon}</span>
                    <span>
                      <span className="block font-medium">{o.label}</span>
                      <span className="text-xs text-muted-foreground">{o.note}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">Guardar automáticamente</span>
                <span className="text-xs text-muted-foreground">Al leer factura y pago válidos se guarda sin pulsar nada.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSave}
                onClick={() => setAutoSave((v) => !v)}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", autoSave ? "bg-primary" : "bg-muted-foreground/30")}
              >
                <motion.span layout className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow", autoSave ? "right-0.5" : "left-0.5")} />
              </button>
            </label>
            <ShimmerButton onClick={() => leer()} disabled={!!reading || (!files.factura && !files.comprobante)} className="h-11 w-full">
              <TbScan className="size-5" /> {reading ? "Leyendo…" : "Volver a leer datos"}
            </ShimmerButton>
          </div>
        </div>

        {/* --- Datos --- */}
        <div className="card relative overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Datos del registro</h2>
            <div className="flex gap-1">
              {crudo && (
                <button className="btn-ghost btn-sm" onClick={() => setShowCrudo(true)}>
                  <HiOutlineCodeBracket /> Texto leído
                </button>
              )}
              <button className="btn-ghost btn-sm" onClick={reset}>
                <HiOutlineArrowPath /> Limpiar
              </button>
            </div>
          </div>

          <AnimatePresence>
            {reading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-xl bg-accent/50 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-accent-foreground">
                    <TbScan className="size-4 animate-pulse" /> {reading.msg}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: reading.p != null ? `${Math.round(reading.p * 100)}%` : ["10%", "70%", "10%"] }}
                      transition={reading.p != null ? { duration: 0.2 } : { duration: 1.6, repeat: Infinity }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <RegistroForm value={draft} onChange={setDraft} estaciones={estaciones} autoFields={autoFields} errors={errors} />

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-outline" onClick={reset} disabled={saving}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => guardar(draft, files)} disabled={saving || !!reading}>
              <HiCheckCircle /> {saving ? "Guardando…" : draft.referencia ? "Guardar registro" : "Guardar (pago pendiente)"}
            </button>
          </div>
          {reading && <BorderBeam size={160} duration={4} />}
        </div>
      </div>

      <AnimatePresence>
        {ultimo && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 flex flex-col gap-2 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-center gap-2">
              <HiCheckCircle className="size-5 text-success" />
              Último guardado: <b>{ultimo.estacion}</b> · factura <b className="tabular">{ultimo.nro_factura}</b> ·{" "}
              {fmtFecha(ultimo.fecha_emision)} · {fmtBs(ultimo.pago_bs)}
            </span>
            <Link to="/registros" className="btn-outline btn-sm">
              Ver registros
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <CameraCapture
        open={camera !== null}
        title={camera === "comprobante" ? "Foto del comprobante" : "Foto de la factura"}
        onClose={() => setCamera(null)}
        onCapture={(f) => camera && setFile(camera, f)}
      />

      <Modal open={!!dup} onClose={() => setDup(null)} title="Registro duplicado" size="sm">
        {dup && (
          <div className="space-y-4 text-sm">
            <p>
              Ya existe un registro de la factura <b className="tabular">{dup.nro_factura}</b> con la referencia{" "}
              <b className="tabular">{dup.referencia ?? "(sin referencia)"}</b> ({dup.estacion}, {fmtBs(dup.pago_bs)}).
            </p>
            <p className="text-muted-foreground">Si es un pago distinto, corrige la referencia. ¿Guardarlo igualmente?</p>
            <div className="flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setDup(null)}>
                Revisar
              </button>
              <button className="btn-primary" onClick={() => guardar(draft, files, true)}>
                Guardar de todas formas
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showCrudo} onClose={() => setShowCrudo(false)} title="Texto leído del documento" size="lg">
        <pre className="max-h-[60svh] overflow-auto rounded-xl bg-muted p-3 text-xs whitespace-pre-wrap">{crudo}</pre>
      </Modal>
    </>
  );
}

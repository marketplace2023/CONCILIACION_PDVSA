import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { HiArrowPath, HiCheck, HiOutlinePhoto, HiXMark } from "react-icons/hi2";
import { TbCameraRotate, TbRotateClockwise2 } from "react-icons/tb";

/**
 * Cámara a pantalla completa (getUserMedia): el video ocupa toda la pantalla y los controles
 * flotan encima. Se captura el cuadro completo del sensor (lo que se ve y un poco más).
 * Si el navegador no permite la cámara (HTTP sin localhost, permisos denegados) se ofrece
 * el selector nativo con `capture="environment"`, que en móviles abre la cámara del sistema.
 */
export function CameraCapture({
  open,
  title,
  onClose,
  onCapture,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || shot) return;
    let cancelled = false;
    (async () => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara aquí (requiere HTTPS). Usa la cámara del dispositivo.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("No se pudo acceder a la cámara. Revisa los permisos o usa la cámara del dispositivo.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing, shot]);

  // Bloquea el scroll de la página mientras la cámara está abierta
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const discard = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
  };

  const close = () => {
    discard();
    onClose();
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && setShot({ url: URL.createObjectURL(b), blob: b }), "image/jpeg", 0.92);
  };

  /** Gira la foto 90° en sentido horario (las facturas suelen fotografiarse de lado). */
  const rotate = async () => {
    if (!shot) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(shot.blob);
      const c = document.createElement("canvas");
      c.width = bmp.height;
      c.height = bmp.width;
      const ctx = c.getContext("2d")!;
      ctx.translate(c.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const b = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.92));
      if (b) {
        URL.revokeObjectURL(shot.url);
        setShot({ url: URL.createObjectURL(b), blob: b });
      }
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!shot) return;
    onCapture(new File([shot.blob], `${title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.jpg`, { type: "image/jpeg" }));
    close();
  };

  const roundBtn =
    "grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95 disabled:opacity-50 [&_svg]:size-6";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Imagen a pantalla completa */}
          {shot ? (
            <img src={shot.url} alt="Captura" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
          )}
          {flash && <div className="pointer-events-none absolute inset-0 bg-white/70" />}

          {/* Esquinas guía, finas para no tapar el documento */}
          {!shot && !error && (
            <div className="pointer-events-none absolute inset-x-4 top-[72px] bottom-[132px]">
              {["top-0 left-0 border-t-2 border-l-2 rounded-tl-xl", "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"].map((c) => (
                <span key={c} className={`absolute size-8 border-white/80 ${c}`} />
              ))}
            </div>
          )}

          {error && !shot && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-white/80">{error}</div>
          )}

          {/* Barra superior */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pt-[max(12px,env(safe-area-inset-top))] pb-6">
            <span className="text-sm font-medium drop-shadow">{shot ? "¿Se lee bien?" : title}</span>
            <button className={roundBtn + " size-10 [&_svg]:size-5"} onClick={close} aria-label="Cerrar cámara">
              <HiXMark />
            </button>
          </div>

          {/* Controles inferiores */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pt-10 pb-[max(20px,env(safe-area-inset-bottom))]">
            {shot ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-1">
                  <button className={roundBtn} onClick={discard} aria-label="Repetir foto">
                    <HiArrowPath />
                  </button>
                  <span className="text-[11px] text-white/80">Repetir</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={accept}
                    className="grid size-[72px] place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95 [&_svg]:size-8"
                    aria-label="Usar esta foto"
                  >
                    <HiCheck />
                  </button>
                  <span className="text-[11px] text-white/80">Usar foto</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button className={roundBtn} onClick={rotate} disabled={busy} aria-label="Girar 90 grados">
                    <TbRotateClockwise2 />
                  </button>
                  <span className="text-[11px] text-white/80">Girar</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-1">
                  <button className={roundBtn} onClick={() => fallbackRef.current?.click()} aria-label="Cámara del dispositivo o galería">
                    <HiOutlinePhoto />
                  </button>
                  <span className="text-[11px] text-white/80">Sistema</span>
                </div>
                <button
                  onClick={capture}
                  disabled={!!error}
                  className="grid size-[76px] place-items-center rounded-full border-4 border-white/90 transition active:scale-95 disabled:opacity-40"
                  aria-label="Tomar foto"
                >
                  <span className="size-[60px] rounded-full bg-white" />
                </button>
                <div className="flex flex-col items-center gap-1">
                  <button
                    className={roundBtn}
                    disabled={!!error}
                    onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                    aria-label="Cambiar cámara"
                  >
                    <TbCameraRotate />
                  </button>
                  <span className="text-[11px] text-white/80">Cambiar</span>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fallbackRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onCapture(f);
                close();
              }
              e.target.value = "";
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

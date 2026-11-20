// Aceternity UI — File Upload (https://ui.aceternity.com/components/file-upload), adaptado:
// un archivo por zona, vista previa de imagen, botón de cámara y acepta imagen/PDF.
import { useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HiOutlineArrowUpTray, HiOutlineCamera, HiOutlineDocumentText, HiXMark } from "react-icons/hi2";
import { cn } from "@/lib/utils";

const mainVariant = { initial: { x: 0, y: 0 }, animate: { x: 16, y: -16, opacity: 0.9 } };
const secondaryVariant = { initial: { opacity: 0 }, animate: { opacity: 1 } };

function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="flex shrink-0 scale-105 flex-wrap items-center justify-center gap-x-px gap-y-px bg-muted/60">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={`flex h-10 w-10 shrink-0 rounded-[2px] ${
                index % 2 === 0 ? "bg-muted/40" : "bg-muted/40 shadow-[0px_0px_1px_3px_var(--background)_inset]"
              }`}
            />
          );
        }),
      )}
    </div>
  );
}

interface FileUploadProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  file: File | null;
  previewUrl?: string | null;
  accept?: string;
  onChange: (file: File | null) => void;
  onCamera?: () => void;
  scanning?: boolean;
  className?: string;
}

export function FileUpload({
  title,
  hint = "Arrastra o haz clic para subir",
  icon,
  file,
  previewUrl,
  accept = "image/*,application/pdf",
  onChange,
  onCamera,
  scanning,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const lid = useId();

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onChange(f);
  };

  return (
    <div className={cn("w-full", className)}>
      <motion.div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
        whileHover="animate"
        className={cn(
          "group/file relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-dashed bg-card p-5 transition-colors",
          drag ? "border-primary bg-accent/40" : "hover:border-primary/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
          <GridPattern />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            {title}
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">{hint}</p>

          <div className="relative mx-auto mt-5 w-full max-w-sm">
            <AnimatePresence mode="popLayout">
              {file ? (
                <motion.div
                  key={file.name + file.size}
                  layoutId={lid}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative z-40 mx-auto flex w-full flex-col overflow-hidden rounded-xl border bg-background shadow-sm"
                >
                  {previewUrl ? (
                    <div className="relative max-h-64 overflow-hidden bg-muted">
                      <img src={previewUrl} alt={title} className="mx-auto max-h-64 w-full object-contain" />
                      {scanning && (
                        <div className="pointer-events-none absolute inset-0 bg-primary/5">
                          <div className="absolute inset-x-0 h-0.5 animate-scan bg-primary shadow-[0_0_16px_4px_var(--primary)]" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-muted text-muted-foreground">
                      <HiOutlineDocumentText className="size-10" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "archivo"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(null);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Quitar archivo"
                    >
                      <HiXMark className="size-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <motion.div
                    layoutId={lid}
                    variants={mainVariant}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="relative z-40 mx-auto flex h-28 w-full max-w-[8rem] items-center justify-center rounded-xl bg-background shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                  >
                    {drag ? (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-xs text-primary">
                        Suelta aquí
                        <HiOutlineArrowUpTray className="mt-1 size-4" />
                      </motion.p>
                    ) : (
                      <HiOutlineArrowUpTray className="size-5 text-muted-foreground" />
                    )}
                  </motion.div>
                  <motion.div
                    variants={secondaryVariant}
                    className="absolute inset-0 z-30 mx-auto flex h-28 w-full max-w-[8rem] items-center justify-center rounded-xl border border-dashed border-primary bg-transparent opacity-0"
                  />
                </>
              )}
            </AnimatePresence>
          </div>

          {onCamera && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCamera();
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-xs hover:border-primary/50 hover:text-primary"
            >
              <HiOutlineCamera className="size-4" /> Usar cámara
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

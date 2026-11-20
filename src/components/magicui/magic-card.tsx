// Magic UI — Magic Card (https://magicui.design/docs/components/magic-card)
import { useCallback, useEffect, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

interface MagicCardProps {
  children?: ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

export function MagicCard({
  children,
  className,
  gradientSize = 220,
  gradientColor = "color-mix(in oklch, var(--primary) 14%, transparent)",
  gradientOpacity = 0.8,
  gradientFrom = "oklch(0.62 0.22 27)",
  gradientTo = "oklch(0.8 0.16 70)",
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { left, top } = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - left);
      mouseY.set(e.clientY - top);
    },
    [mouseX, mouseY],
  );
  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [gradientSize, mouseX, mouseY]);

  useEffect(() => reset(), [reset]);

  return (
    <div
      className={cn("group relative rounded-2xl", className)}
      onPointerMove={handleMouseMove}
      onPointerLeave={reset}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-border duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, var(--border) 100%)`,
        }}
      />
      <div className="absolute inset-px rounded-[inherit] bg-card" />
      <motion.div
        className="pointer-events-none absolute inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`,
          opacity: gradientOpacity,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

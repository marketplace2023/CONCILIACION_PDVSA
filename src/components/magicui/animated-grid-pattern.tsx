// Magic UI — Animated Grid Pattern (https://magicui.design/docs/components/animated-grid-pattern)
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  numSquares = 40,
  className,
  maxOpacity = 0.5,
  duration = 4,
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const getPos = useCallback(
    (): [number, number] => [
      Math.floor((Math.random() * dimensions.width) / width),
      Math.floor((Math.random() * dimensions.height) / height),
    ],
    [dimensions, width, height],
  );
  const generateSquares = useCallback(
    (count: number) => Array.from({ length: count }, (_, i) => ({ id: i, pos: getPos() })),
    [getPos],
  );
  const [squares, setSquares] = useState<Array<{ id: number; pos: [number, number] }>>([]);

  const updateSquarePosition = (sqId: number) =>
    setSquares((cur) => cur.map((sq) => (sq.id === sqId ? { ...sq, pos: getPos() } : sq)));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (dimensions.width && dimensions.height) setSquares(generateSquares(numSquares));
  }, [dimensions, numSquares, generateSquares]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full fill-primary/20 stroke-foreground/10", className)}
    >
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse">
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={0} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg className="overflow-visible">
        {squares.map(({ pos: [x, y], id: sqId }, index) => (
          <motion.rect
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{ duration, repeat: 1, delay: index * 0.1, repeatType: "reverse" }}
            onAnimationComplete={() => updateSquarePosition(sqId)}
            key={`${x}-${y}-${index}`}
            width={width - 1}
            height={height - 1}
            x={x * width + 1}
            y={y * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  );
}

// Aceternity UI — Background Gradient (https://ui.aceternity.com/components/background-gradient)
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function BackgroundGradient({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) {
  const variants = { initial: { backgroundPosition: "0 50%" }, animate: { backgroundPosition: ["0, 50%", "100% 50%", "0 50%"] } };
  const bg =
    "bg-[radial-gradient(circle_farthest-side_at_0_100%,oklch(0.62_0.22_27),transparent),radial-gradient(circle_farthest-side_at_100%_0,oklch(0.78_0.16_65),transparent),radial-gradient(circle_farthest-side_at_100%_100%,oklch(0.55_0.2_15),transparent),radial-gradient(circle_farthest-side_at_0_0,oklch(0.7_0.18_40),oklch(0.2_0.02_20))]";
  const common = {
    variants: animate ? variants : undefined,
    initial: animate ? "initial" : undefined,
    animate: animate ? "animate" : undefined,
    transition: animate ? { duration: 5, repeat: Infinity, repeatType: "reverse" as const } : undefined,
    style: { backgroundSize: animate ? "400% 400%" : undefined },
  };
  return (
    <div className={cn("group relative p-[3px]", containerClassName)}>
      <motion.div
        {...common}
        className={cn("absolute inset-0 z-[1] rounded-3xl opacity-50 blur-xl transition duration-500 will-change-transform group-hover:opacity-80", bg)}
      />
      <motion.div {...common} className={cn("absolute inset-0 z-[1] rounded-3xl will-change-transform", bg)} />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
}

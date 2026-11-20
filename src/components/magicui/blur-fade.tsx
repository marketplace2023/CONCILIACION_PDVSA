// Magic UI — Blur Fade (https://magicui.design/docs/components/blur-fade)
import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  offset?: number;
  inView?: boolean;
  blur?: string;
}

export function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 8,
  inView = false,
  blur = "6px",
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: "-50px" });
  const isInView = !inView || inViewResult;
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={{
          hidden: { y: offset, opacity: 0, filter: `blur(${blur})` },
          visible: { y: 0, opacity: 1, filter: "blur(0px)" },
        }}
        transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

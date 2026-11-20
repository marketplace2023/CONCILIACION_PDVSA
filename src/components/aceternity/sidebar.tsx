// Aceternity UI — Sidebar (https://ui.aceternity.com/components/sidebar), adaptado a react-router.
// Escritorio: se expande al pasar el ratón. Móvil: barra superior + panel deslizable.
import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { NavLink } from "react-router-dom";
import { HiBars3, HiXMark } from "react-icons/hi2";
import { cn } from "@/lib/utils";

interface SidebarCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const Ctx = createContext<SidebarCtx | undefined>(undefined);
// eslint-disable-next-line react-refresh/only-export-components
export const useSidebar = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSidebar debe usarse dentro de <Sidebar>");
  return c;
};

export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function SidebarBody({ children, mobileHeader }: { children: ReactNode; mobileHeader: ReactNode }) {
  return (
    <>
      <DesktopSidebar>{children}</DesktopSidebar>
      <MobileSidebar header={mobileHeader}>{children}</MobileSidebar>
    </>
  );
}

function DesktopSidebar({ children }: { children: ReactNode }) {
  const { open, setOpen } = useSidebar();
  return (
    <motion.aside
      className="sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex"
      animate={{ width: open ? 248 : 68 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </motion.aside>
  );
}

function MobileSidebar({ children, header }: { children: ReactNode; header: ReactNode }) {
  const { open, setOpen } = useSidebar();
  return (
    <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-sidebar/90 px-4 backdrop-blur md:hidden">
      {header}
      <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setOpen(true)} aria-label="Abrir menú">
        <HiBars3 className="size-6" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 left-0 z-[100] flex w-[82%] max-w-xs flex-col bg-sidebar p-4 shadow-2xl"
            >
              <button
                className="absolute top-3 right-3 rounded-lg p-2 hover:bg-muted"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
              >
                <HiXMark className="size-5" />
              </button>
              {children}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SidebarLink({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  const { open, setOpen } = useSidebar();
  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => window.innerWidth < 768 && setOpen(false)}
      className={({ isActive }) =>
        cn(
          "group/link flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <span className="shrink-0 text-[1.2rem]">{icon}</span>
      <SidebarLabel open={open}>{label}</SidebarLabel>
    </NavLink>
  );
}

export function SidebarLabel({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <motion.span
      animate={{ opacity: open ? 1 : 0, display: open ? "inline-block" : "none" }}
      className={cn(
        "whitespace-pre transition duration-150 group-hover/link:translate-x-0.5 max-md:!inline-block max-md:!opacity-100",
        className,
      )}
    >
      {children}
    </motion.span>
  );
}

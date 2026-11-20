import { Suspense, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { motion } from "motion/react";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineCamera,
  HiOutlineDocumentArrowUp,
  HiOutlineMoon,
  HiOutlineSquares2X2,
  HiOutlineSun,
  HiOutlineTableCells,
  HiOutlineUserCircle,
  HiOutlineUsers,
} from "react-icons/hi2";
import { BsFuelPump } from "react-icons/bs";
import { Sidebar, SidebarBody, SidebarLabel, SidebarLink, useSidebar } from "@/components/aceternity/sidebar";
import { useAuth } from "@/lib/auth";

function Logo({ compact }: { compact?: boolean }) {
  const { open } = useSidebar();
  return (
    <Link to="/" className="group/link flex items-center gap-2.5 px-1 py-1">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-md shadow-primary/30">
        <BsFuelPump className="size-[18px]" />
      </span>
      {compact ? (
        <span className="text-sm font-semibold tracking-tight">Conciliación</span>
      ) : (
        <SidebarLabel open={open} className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Conciliación PDVSA</span>
          <span className="block text-[11px] text-muted-foreground">CORPOMÉRIDA</span>
        </SidebarLabel>
      )}
    </Link>
  );
}

function ThemeToggle() {
  const { open } = useSidebar();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try {
      localStorage.setItem("conciliacion.theme", d ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      className="group/link flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <span className="shrink-0 text-[1.2rem]">{dark ? <HiOutlineSun /> : <HiOutlineMoon />}</span>
      <SidebarLabel open={open}>{dark ? "Modo claro" : "Modo oscuro"}</SidebarLabel>
    </button>
  );
}

function UserBox() {
  const { user, logout } = useAuth();
  const { open } = useSidebar();
  if (!user) return null;
  const initials = user.nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="mt-2 border-t pt-3">
      <Link to="/perfil" className="group/link flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-muted">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {initials}
        </span>
        <SidebarLabel open={open} className="min-w-0 leading-tight">
          <span className="block max-w-36 truncate text-sm font-medium">{user.nombre}</span>
          <span className="block text-[11px] text-muted-foreground capitalize">{user.rol}</span>
        </SidebarLabel>
      </Link>
      <button
        onClick={logout}
        className="group/link mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <span className="shrink-0 text-[1.2rem]">
          <HiOutlineArrowRightOnRectangle />
        </span>
        <SidebarLabel open={open}>Cerrar sesión</SidebarLabel>
      </button>
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const links = [
    { to: "/", label: "Inicio", icon: <HiOutlineSquares2X2 />, end: true },
    { to: "/escanear", label: "Escanear factura", icon: <HiOutlineCamera /> },
    { to: "/importar", label: "Importar PDF", icon: <HiOutlineDocumentArrowUp /> },
    { to: "/registros", label: "Registros", icon: <HiOutlineTableCells /> },
    ...(user?.rol === "admin" ? [{ to: "/usuarios", label: "Usuarios", icon: <HiOutlineUsers /> }] : []),
    { to: "/perfil", label: "Mi perfil", icon: <HiOutlineUserCircle /> },
  ];

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar>
        <SidebarBody mobileHeader={<Logo compact />}>
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />
            <nav className="mt-6 flex flex-col gap-1">
              {links.map((l) => (
                <SidebarLink key={l.to} {...l} />
              ))}
            </nav>
          </div>
          <ThemeToggle />
          <UserBox />
        </SidebarBody>
      </Sidebar>
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8"
      >
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<div className="grid h-64 place-items-center"><div className="size-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </motion.main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

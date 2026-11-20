import { lazy, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/pages/app-layout";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { DashboardPage } from "@/pages/dashboard";
const EscanearPage = lazy(() => import("@/pages/escanear").then((m) => ({ default: m.EscanearPage })));
const ImportarPdfPage = lazy(() => import("@/pages/importar-pdf").then((m) => ({ default: m.ImportarPdfPage })));
const RegistrosPage = lazy(() => import("@/pages/registros").then((m) => ({ default: m.RegistrosPage })));
const UsuariosPage = lazy(() => import("@/pages/usuarios").then((m) => ({ default: m.UsuariosPage })));
import { PerfilPage } from "@/pages/perfil";

function Splash() {
  return (
    <div className="grid min-h-svh place-items-center">
      <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}

function Protected({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (admin && user.rol !== "admin") return <Navigate to="/" replace />;
  return children;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/registro" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route index element={<DashboardPage />} />
            <Route path="escanear" element={<EscanearPage />} />
            <Route path="importar" element={<ImportarPdfPage />} />
            <Route path="registros" element={<RegistrosPage />} />
            <Route path="perfil" element={<PerfilPage />} />
            <Route path="usuarios" element={<Protected admin><UsuariosPage /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" closeButton />
    </AuthProvider>
  );
}

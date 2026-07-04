import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Sidebar } from "@/layout/Sidebar";
import { TopBar } from "@/layout/TopBar";
import type { View } from "@/layout/navConfig";
import { viewRegistry } from "@/layout/viewRegistry";
import { useAuth } from "@/auth/AuthContext";
import { LoginView } from "@/auth/LoginView";
import type { ShellId } from "@/auth/roles";
import { PortalShell } from "@/portals/PortalShell";
import { portalMeta, shellHomePath } from "@/portals/portalMeta";

function LoginRoute() {
  const { currentUser, currentRole } = useAuth();
  if (currentUser && currentRole) return <Navigate to={shellHomePath[currentRole.shell]} replace />;
  return <LoginView />;
}

function HomeRedirect() {
  const { currentUser, currentRole } = useAuth();
  if (!currentUser || !currentRole) return <Navigate to="/login" replace />;
  return <Navigate to={shellHomePath[currentRole.shell]} replace />;
}

function ProtectedRoute({ shell, children }: { shell: ShellId; children: React.ReactNode }) {
  const { currentUser, currentRole } = useAuth();
  if (!currentUser || !currentRole) return <Navigate to="/login" replace />;
  if (currentRole.shell !== shell) return <Navigate to={shellHomePath[currentRole.shell]} replace />;
  return <>{children}</>;
}

function ErpShell() {
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const ActiveView = viewRegistry[view] ?? viewRegistry.dashboard;

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'Outfit', sans-serif" }}>
      <Sidebar current={view} onNavigate={setView} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar current={view} />
        <main className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(201,162,74,0.15) transparent" }}>
          <ActiveView />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/app/*" element={<ProtectedRoute shell="erp"><ErpShell /></ProtectedRoute>} />
        <Route path="/portal/client/*" element={<ProtectedRoute shell="client-portal"><PortalShell meta={portalMeta["client-portal"]} /></ProtectedRoute>} />
        <Route path="/portal/partner/*" element={<ProtectedRoute shell="partner-portal"><PortalShell meta={portalMeta["partner-portal"]} /></ProtectedRoute>} />
        <Route path="/portal/company/*" element={<ProtectedRoute shell="company-portal"><PortalShell meta={portalMeta["company-portal"]} /></ProtectedRoute>} />
        <Route path="/portal/provider/*" element={<ProtectedRoute shell="provider-portal"><PortalShell meta={portalMeta["provider-portal"]} /></ProtectedRoute>} />
        <Route path="/portal/expert/*" element={<ProtectedRoute shell="expert-portal"><PortalShell meta={portalMeta["expert-portal"]} /></ProtectedRoute>} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { InternalNavigationProvider } from "@/navigation/InternalNavigationContext";
import { PageLoader } from "@/components/shared/PageLoader";
import SanteAdminConsole from "@/features/sante/SanteAdminConsole";
import { useAuth } from "@/auth/AuthContext";
import { AssistanceBanner } from "@/auth/AssistanceBanner";
import { LoginView } from "@/auth/LoginView";
import { ChangementMotDePasseObligatoire } from "@/auth/ChangementMotDePasseObligatoire";
import type { ShellId } from "@/auth/roles";
import { PortalShell } from "@/portals/PortalShell";
import { portalMeta, shellHomePath } from "@/portals/portalMeta";
import SignaturePage from "@/features/signature-publique/SignaturePage";
import VerificationPage from "@/features/verification-publique/VerificationPage";

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
  // Mot de passe temporaire (2026-09) — voir demande utilisateur : "la
  // saisie du mot de passe pour la première fois ne demande pas de
  // réinitialiser le mot de passe à la première connexion". Bloque TOUT
  // accès aux données (quel que soit le shell/rôle) tant que le titulaire
  // n'a pas choisi lui-même un nouveau mot de passe.
  if (currentUser.doitChangerMotDePasse) return <ChangementMotDePasseObligatoire />;
  return <>{children}</>;
}

/**
 * MedAssur is a single-application health insurer console: every internal
 * role lands directly in it after login, no intermediate generic shell.
 */
function ErpShell() {
  return <SanteAdminConsole />;
}

export default function App() {
  return (
    <BrowserRouter>
      <InternalNavigationProvider>
        <PageLoader />
        <AssistanceBanner />
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          {/* Publique, sans authentification (2026-09) — voir demande
              utilisateur : QR code de signature scanné depuis un téléphone
              jamais connecté sur cet appareil. Le jeton dans l'URL fait
              foi (voir SignaturePubliqueController côté backend). */}
          <Route path="/signer/:token" element={<SignaturePage />} />
          {/* Publique, sans authentification (2026-09) — voir demande
              utilisateur : QR code d'authenticité de document scanné
              depuis un téléphone jamais connecté sur cet appareil (voir
              VerificationPubliqueController côté backend). */}
          <Route path="/verifier/:id" element={<VerificationPage />} />
          <Route path="/app/*" element={<ProtectedRoute shell="erp"><ErpShell /></ProtectedRoute>} />
          <Route path="/portal/client/*" element={<ProtectedRoute shell="client-portal"><PortalShell meta={portalMeta["client-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/partner/*" element={<ProtectedRoute shell="partner-portal"><PortalShell meta={portalMeta["partner-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/company/*" element={<ProtectedRoute shell="company-portal"><PortalShell meta={portalMeta["company-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/provider/*" element={<ProtectedRoute shell="provider-portal"><PortalShell meta={portalMeta["provider-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/expert/*" element={<ProtectedRoute shell="expert-portal"><PortalShell meta={portalMeta["expert-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/membre/*" element={<ProtectedRoute shell="member-portal"><PortalShell meta={portalMeta["member-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/medecin/*" element={<ProtectedRoute shell="medecin-portal"><PortalShell meta={portalMeta["medecin-portal"]} /></ProtectedRoute>} />
          <Route path="/portal/super-admin/*" element={<ProtectedRoute shell="super-admin-portal"><PortalShell meta={portalMeta["super-admin-portal"]} /></ProtectedRoute>} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </InternalNavigationProvider>
    </BrowserRouter>
  );
}

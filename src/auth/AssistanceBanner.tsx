import { ShieldAlert, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/auth/AuthContext";

// Bandeau persistant de mode assistance (2026-09) — voir demande
// utilisateur : "le Super Admin doit pouvoir accéder dans chaque interface
// dédiée aux société en mode assistance." Monté une seule fois au sommet de
// l'application (voir App.tsx), au-dessus de N'IMPORTE QUEL shell/portail —
// rappelle en permanence qu'on agit AU NOM d'une société et permet de
// revenir au Super Admin en un clic, sans repasser par un mot de passe.
export function AssistanceBanner() {
  const { assistance, endAssistance } = useAuth();
  const navigate = useNavigate();
  if (!assistance) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[999] h-8 bg-amber-500 text-white flex items-center justify-center gap-2 text-[12.5px] font-semibold shadow-md">
      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Mode assistance — {assistance.societeNom}</span>
      <button
        type="button"
        onClick={() => { endAssistance(); navigate("/portal/super-admin", { replace: true }); }}
        className="ml-2 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors rounded px-2 py-0.5"
      >
        <X className="w-3 h-3" />Quitter
      </button>
    </div>
  );
}

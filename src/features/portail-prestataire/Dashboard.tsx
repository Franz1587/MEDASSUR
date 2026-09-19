import { useEffect, useState } from "react";
import { Users2, Building2 } from "lucide-react";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { getPrestataireDashboard, type PrestataireDashboard } from "@/services/portailPrestataire.service";

// Accueil du portail prestataire (2026-08) — voir demande utilisateur :
// "portail externe dédié au prestataire médical... je veux que tu duplique
// cela", capture de référence fournie par l'utilisateur : deux grandes tuiles
// d'accès rapide (Les patients / Prestations), identiques à la maquette.
export default function PrestataireDashboardView() {
  const { setView } = useShellNavigation();
  const [data, setData] = useState<PrestataireDashboard | null>(null);

  useEffect(() => { getPrestataireDashboard().then(setData); }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Accueil</h1>
        {data && <p className="text-[12.5px] text-muted-foreground mt-0.5">{data.nom}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mb-6">
        <button
          type="button"
          onClick={() => setView("prestatairePatients")}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 transition-colors"
        >
          <Users2 className="w-16 h-16 text-primary" strokeWidth={1.5} />
          <span className="text-[14px] font-semibold text-foreground">Les patients</span>
        </button>
        <button
          type="button"
          onClick={() => setView("prestatairePrestations")}
          className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-primary/40 transition-colors"
        >
          <Building2 className="w-16 h-16 text-primary" strokeWidth={1.5} />
          <span className="text-[14px] font-semibold text-foreground">Prestations</span>
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4 max-w-5xl">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Prestations totales</p>
            <p className="text-[18px] font-bold text-foreground mt-1">{data.totalPrestations}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">En saisie</p>
            <p className="text-[18px] font-bold text-amber-600 mt-1">{data.enSaisie}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Télétransmises</p>
            <p className="text-[18px] font-bold text-emerald-600 mt-1">{data.soumises}</p>
          </div>
        </div>
      )}
    </div>
  );
}

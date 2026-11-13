import { Building2 } from "lucide-react";
import { useAuth, type StructureMedecin } from "@/auth/AuthContext";

// Modal de sélection de structure médicale (2026-11) — affiché à la connexion
// d'un médecin lié à plusieurs établissements (MedecinPrestataire n > 1).
// Bloquant : le médecin doit choisir SA structure active avant d'accéder au
// portail. Le choix est mémorisé par medecinId dans localStorage et restauré
// automatiquement aux connexions suivantes.
export function ChoixStructureMedecin() {
  const { structuresMedecin, choisirStructureMedecin } = useAuth();
  if (structuresMedecin.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">Choisissez votre structure</p>
            <p className="text-[12.5px] text-muted-foreground">Pour quelle structure exercez-vous aujourd'hui ?</p>
          </div>
        </div>

        <div className="space-y-2">
          {structuresMedecin.map((s: StructureMedecin) => (
            <button
              key={s.id}
              type="button"
              onClick={() => choisirStructureMedecin(s.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <span className="text-[13.5px] font-medium text-foreground group-hover:text-primary">{s.nom}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

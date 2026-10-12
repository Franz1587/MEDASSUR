import { Building2 } from "lucide-react";
import { useClientSociete } from "./ClientSocieteContext";
import type { ClientSociete } from "@/services/portailPrestataire.service";

const TYPE_LABEL: Record<string, string> = {
  Compagnie: "Compagnie d'assurance",
  Courtier: "Courtier",
  Mutuelle: "Mutuelle / IPM",
};

// Écran de sélection du client (société MEDASSUR+) pour les prestataires
// qui servent plusieurs organismes (2026-10). Affiché une seule fois au
// démarrage du portail quand mesClients > 1 (sinon sauté automatiquement).
export default function SelecteurClientSociete() {
  const { clients, setClientActif } = useClientSociete();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1.5">
          <Building2 className="w-10 h-10 text-primary mx-auto" strokeWidth={1.5} />
          <h1 className="text-[1.1rem] font-bold text-foreground">Pour quel client ?</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Sélectionnez l'organisme assureur dont vous souhaitez identifier les assurés.
          </p>
        </div>

        <div className="space-y-2.5">
          {clients.map((c: ClientSociete) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClientActif(c)}
              className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-foreground truncate">{c.nom}</p>
                <p className="text-[11px] text-muted-foreground">{TYPE_LABEL[c.type] ?? c.type}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

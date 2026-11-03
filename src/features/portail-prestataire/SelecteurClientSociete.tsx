import { Building2 } from "lucide-react";
import { useClientSociete } from "./ClientSocieteContext";
import { logoEntrepriseUrl } from "@/services/parametresEntreprise.service";
import type { ClientSociete } from "@/services/portailPrestataire.service";
export type { ClientSociete };

const TYPE_LABEL: Record<string, string> = {
  Compagnie: "Compagnie d'assurance",
  Courtier: "Courtier",
  Mutuelle: "Mutuelle / IPM",
};

// Carte sélecteur réutilisable (inline ou plein écran).
export function CarteClientSociete({ c, onClick }: { c: ClientSociete; onClick: () => void }) {
  const logoSrc = logoEntrepriseUrl(c.logo);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors p-4 flex items-center gap-3"
    >
      <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center shrink-0 overflow-hidden">
        {logoSrc ? (
          <img src={logoSrc} alt={c.nom} className="w-full h-full object-contain p-1" />
        ) : (
          <Building2 className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-foreground truncate">{c.nom}</p>
        <p className="text-[11px] text-muted-foreground">{TYPE_LABEL[c.type] ?? c.type}</p>
      </div>
    </button>
  );
}

// Sélecteur compact horizontal — affiché en haut d'une page quand multi-clients.
export function SocieteSwitcherInline() {
  const { clients, clientActif, setClientActif } = useClientSociete();
  if (clients.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      {clients.map((c) => {
        const logoSrc = logoEntrepriseUrl(c.logo);
        const isActif = c.id === clientActif?.id;
        return (
          <button
            key={c.id} type="button" onClick={() => setClientActif(c)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
              isActif ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span className="w-5 h-5 flex items-center justify-center overflow-hidden shrink-0">
              {logoSrc
                ? <img src={logoSrc} alt={c.nom} className="w-full h-full object-contain" />
                : <Building2 className="w-4 h-4" />}
            </span>
            {c.nom}
          </button>
        );
      })}
    </div>
  );
}

// Écran de sélection plein écran (affiché quand mesClients > 1 et aucun actif).
export default function SelecteurClientSociete() {
  const { clients, setClientActif } = useClientSociete();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1.5">
          <Building2 className="w-10 h-10 text-primary mx-auto" strokeWidth={1.5} />
          <h1 className="text-[1.1rem] font-bold text-foreground">Pour quel client ?</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Sélectionnez l'organisme assureur dont vous souhaitez traiter les dossiers.
          </p>
        </div>
        <div className="space-y-2.5">
          {clients.map((c: ClientSociete) => (
            <CarteClientSociete key={c.id} c={c} onClick={() => setClientActif(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

import { type ReactNode, useState } from "react";
import { Building2 } from "lucide-react";
import { useClientSociete } from "./ClientSocieteContext";
import { logoEntrepriseUrl } from "@/services/parametresEntreprise.service";
import type { ClientSociete } from "@/services/portailPrestataire.service";
import logoMedassurPlus from "@/assets/logo-mark.png";
export type { ClientSociete };

const TYPE_LABEL: Record<string, string> = {
  Compagnie: "Compagnie d'assurance",
  Courtier: "Courtier",
  Mutuelle: "Mutuelle / IPM",
};

// Carte sélecteur réutilisable (inline ou plein écran).
export function CarteClientSociete({ c, onClick }: { c: ClientSociete; onClick: () => void }) {
  const logoSrc = c.id === "societe-bootstrap" ? logoMedassurPlus : logoEntrepriseUrl(c.logo);
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

// Porte bloquante overlay — enveloppe le contenu de la page :
// quand verrouillée, le contenu s'affiche flou en arrière-plan et une
// bulle modale demande à l'utilisateur de choisir un organisme.
export function SocieteGate({
  societeOk, onSelect, children,
}: {
  societeOk: boolean;
  onSelect: (c: ClientSociete) => void;
  children: ReactNode;
}) {
  const { clients } = useClientSociete();
  return (
    <div className="relative">
      {/* Contenu — flou + non-interactif tant que verrou actif */}
      <div className={!societeOk ? "blur-sm pointer-events-none select-none opacity-60" : ""}>
        {children}
      </div>
      {/* Bulle modale de sélection */}
      {!societeOk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="w-7 h-7 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-[1.05rem] font-bold text-foreground">Pour quel organisme ?</h2>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Sélectionnez l'assureur pour consulter ou saisir les données.
              </p>
            </div>
            <div className="space-y-2">
              {clients.map((c) => (
                <CarteClientSociete key={c.id} c={c} onClick={() => onSelect(c)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sélecteur compact horizontal — toujours affiché dès qu'il y a au moins un client.
// Un seul client : badge de contexte (non interactif). Plusieurs : boutons cliquables.
export function SocieteSwitcherInline() {
  const { clients, clientActif, setClientActif } = useClientSociete();
  if (clients.length === 0 || !clientActif) return null;

  const chipCls = (isActif: boolean, clickable: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
      isActif ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
    } ${clickable ? "hover:border-primary/40 hover:text-foreground cursor-pointer" : "cursor-default"}`;

  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      <span className="text-[11.5px] text-muted-foreground shrink-0">Organisme :</span>
      {clients.map((c) => {
        const logoSrc = logoEntrepriseUrl(c.logo);
        const isActif = c.id === clientActif.id;
        const logo = (
          <span className="w-5 h-5 flex items-center justify-center overflow-hidden shrink-0">
            {logoSrc ? <img src={logoSrc} alt={c.nom} className="w-full h-full object-contain" /> : <Building2 className="w-4 h-4" />}
          </span>
        );
        if (clients.length > 1) {
          return (
            <button key={c.id} type="button" onClick={() => setClientActif(c)} className={chipCls(isActif, true)}>
              {logo}{c.nom}
            </button>
          );
        }
        return (
          <span key={c.id} className={chipCls(isActif, false)}>{logo}{c.nom}</span>
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

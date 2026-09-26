import { UserCog } from "lucide-react";
import PopulationPanel from "@/features/contrats/PopulationPanel";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

interface Props {
  contrat: Contrat;
  onClose: () => void;
  onUpdated: (contrat: Contrat) => void;
}

// Chrome de modale autour de PopulationPanel (déclenchée depuis l'icône
// "Gérer les assurés" de la liste des contrats) — tout le contenu (recherche,
// familles, détail/édition, sélection groupée, export, ajout) vit dans
// PopulationPanel, partagé à l'identique avec l'onglet Population de la
// fiche contrat en édition (contrats/index.tsx), pour ne jamais diverger.
export default function GestionPopulationModal({ contrat, onClose, onUpdated }: Props) {
  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><UserCog className="w-4 h-4 text-primary" />Gestion des assurés — {numeroPolice(contrat)}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{contrat.client} · Exercice n°{contrat.exerciceNumero ?? 1}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          <PopulationPanel contrat={contrat} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}

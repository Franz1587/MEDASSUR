// Calcul de commission possible par compagnie (2026-08) — voir demande
// utilisateur : "l'application doit pouvoir calculer la commission
// possible pour chaque compagnie en fonction des taux existants" puis
// "sur le tableau de prospection on doit avoir en moyen la commission que
// cela devrait rapporter... une moyenne en fonction des différentes
// commissions de toutes les compagnies." Fonction PURE (aucune dépendance
// Prisma/NestJS) partagée entre CrmService.suggestionsCommission (fiche
// prospect, une compagnie mise en avant) et DocumentsService.
// renderTableauProspection (colonne "Commission moyenne estimée") — pour
// ne jamais dupliquer cette règle de calcul à deux endroits.
export interface CompagnieCommission {
  id: string;
  nom: string;
  logo: string | null;
  tauxCommissionMaladie: number | null;
  tauxCommissionAssistance: number | null;
}

export interface SuggestionCommission {
  compagnieId: string;
  compagnieNom: string;
  compagnieLogo: string | null;
  tauxCommissionMaladie: number | null;
  tauxCommissionAssistance: number | null;
  montantCommissionEstime: number;
}

export function calculerCommissionsProspect(
  valeurEstimee: number, typeContrat: string | null | undefined, compagnies: CompagnieCommission[],
): SuggestionCommission[] {
  const inclutAssistance = typeContrat === "MaladieEtAssistance";
  return compagnies
    .map((c) => {
      const tauxMaladie = c.tauxCommissionMaladie;
      const tauxAssistance = inclutAssistance ? c.tauxCommissionAssistance : null;
      if (tauxMaladie === null && tauxAssistance === null) return null;
      // Répartition indicative 70/30 Maladie/Assistance quand les deux
      // branches sont envisagées — même logique qu'un contrat combiné
      // classique, faute d'un montant distinct saisi par branche à ce
      // stade (le prospect n'a pas encore de Cotation détaillée).
      const partMaladie = inclutAssistance ? valeurEstimee * 0.7 : valeurEstimee;
      const partAssistance = inclutAssistance ? valeurEstimee * 0.3 : 0;
      const montantMaladie = tauxMaladie !== null ? Math.round((partMaladie * tauxMaladie) / 100) : 0;
      const montantAssistance = tauxAssistance !== null ? Math.round((partAssistance * tauxAssistance) / 100) : 0;
      return {
        compagnieId: c.id, compagnieNom: c.nom, compagnieLogo: c.logo,
        tauxCommissionMaladie: tauxMaladie, tauxCommissionAssistance: tauxAssistance,
        montantCommissionEstime: montantMaladie + montantAssistance,
      };
    })
    .filter((s): s is SuggestionCommission => s !== null)
    .sort((a, b) => b.montantCommissionEstime - a.montantCommissionEstime);
}

// Moyenne simple des commissions possibles, toutes compagnies confondues
// (voir demande utilisateur ci-dessus) — 0 si aucune compagnie n'a de taux
// de commission renseigné pour la branche envisagée.
export function commissionMoyenne(suggestions: SuggestionCommission[]): number {
  if (suggestions.length === 0) return 0;
  return Math.round(suggestions.reduce((s, x) => s + x.montantCommissionEstime, 0) / suggestions.length);
}

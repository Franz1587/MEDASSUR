// Montant NET d'un lot de PriseEnCharge — base remboursement moins la TPS
// prélevée, JAMAIS les frais réels bruts (voir mémoire "Montant = net à
// payer" + demande utilisateur : "les informations du règlement maladie ne
// sont pas en harmonie avec les autres données de la chaîne de traitement").
// Règle UNIQUE désormais partagée par BordereauReglement.montantTotal/
// montantValide (ReglementPrestataireService), le chèque réel
// (ReglementComptableService.genererLettreCheque) et le lettrage bancaire
// (LettrageService.lettrageFournisseurs) — auparavant chacun recalculait
// (ou pas) sa propre valeur, d'où des montants différents pour ce qui
// devait être le même règlement.
export function montantNetPrisesEnCharge(lignes: { baseRemboursement: unknown; montantTps: unknown }[]): number {
  return lignes.reduce((s, l) => {
    const base = l.baseRemboursement != null ? Number(l.baseRemboursement) : 0;
    const tps = l.montantTps != null ? Number(l.montantTps) : 0;
    return s + (base - tps);
  }, 0);
}

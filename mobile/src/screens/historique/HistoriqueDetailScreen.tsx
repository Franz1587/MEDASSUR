import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Screen, ScreenHeader, Card, Badge, statutVariant, PrimaryButton,
  ErrorView, LoadingView, formatMontant, formatDate,
} from "../../components/ui";
import { colors, spacing } from "../../theme/colors";
import {
  getMesPrisesEnCharge, cheminDecompte, cheminFeuilleSoins, cheminFeuilleExamen,
  type MembrePriseEnCharge,
} from "../../api/portailMembre";
import { messageErreur } from "../../api/http";
import { typeFormulaire } from "../../utils/groupesActes";
import type { RootStackParamList } from "../../navigation/types";

// Détail d'une ligne d'Historique — même API que la liste (pas d'endpoint
// dédié GET par id côté portail-membre, voir MembrePriseEnCharge dans
// src/api/portailMembre.ts) : on relit la liste complète et on cherche la
// ligne par id, MÊME logique que le panneau "Voir le détail" de
// src/features/portail-membre/Historique.tsx côté web.
function trouverLigne(lignes: MembrePriseEnCharge[], id: string): MembrePriseEnCharge | null {
  for (const l of lignes) {
    if (l.id === id) return l;
    const dansGroupe = l.lignes?.find((x) => x.id === id);
    if (dansGroupe) return l;
  }
  return null;
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function HistoriqueDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "HistoriqueDetail">>();
  const [ligne, setLigne] = useState<MembrePriseEnCharge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lignes = await getMesPrisesEnCharge();
      const trouvee = trouverLigne(lignes, route.params.id);
      if (!trouvee) { setError("Cette prestation est introuvable."); return; }
      setLigne(trouvee);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger le détail."));
    } finally {
      setLoading(false);
    }
  }, [route.params.id]);

  useEffect(() => { load(); }, [load]);

  // Ouverture dans l'application (2026-09) — voir demande utilisateur : "les
  // documents PDF doivent s'ouvrir dans l'application... au lieu de se
  // télécharger systématiquement" — la visionneuse propose elle-même un
  // bouton de téléchargement/partage explicite, pas besoin de le dupliquer ici.
  const ouvrir = (titre: string, chemin: string) => {
    navigation.navigate("DocumentViewer", { path: chemin, titre });
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Détail de la prestation" />
        <LoadingView label="Chargement du détail…" />
      </Screen>
    );
  }

  if (error || !ligne) {
    return (
      <Screen>
        <ScreenHeader title="Détail de la prestation" />
        <ErrorView message={error ?? "Prestation introuvable."} onRetry={load} />
      </Screen>
    );
  }

  const groupe = (ligne.lignes?.length ?? 0) > 1;
  const ligneDecompte = groupe ? ligne.lignes![0] : ligne;
  const formulaire = !groupe ? typeFormulaire(ligne.acteFamille) : null;
  const montantPrincipal = ligne.modePaiement === "Remboursement" && ligne.baseRemboursement != null
    ? { texte: formatMontant(ligne.baseRemboursement), couleur: colors.success }
    : { texte: formatMontant(ligne.montant), couleur: colors.text };

  return (
    <Screen>
      <ScreenHeader title={ligne.type} subtitle={`${ligne.prestataire} · ${formatDate(ligne.date)}`} />

      <Card>
        <View style={styles.headerRow}>
          <Badge label={ligne.assureNom} variant="info" />
          <Badge label={ligne.statut} variant={statutVariant(ligne.statut)} />
        </View>
        <Text style={[styles.montant, { color: montantPrincipal.couleur }]}>{montantPrincipal.texte}</Text>

        <DetailRow label="Rubrique" value={ligne.rubrique} />
        <DetailRow label="Exercice" value={ligne.exercice != null ? String(ligne.exercice) : "—"} />
        <DetailRow label="Mode de paiement" value={ligne.modePaiement ?? "—"} />
        {ligne.acteLibelle ? <DetailRow label="Acte" value={ligne.acteLibelle} /> : null}
        {!groupe && ligne.baseRemboursement != null ? <DetailRow label="Remboursé" value={formatMontant(ligne.baseRemboursement)} /> : null}
        {!groupe && ligne.resteACharge != null ? <DetailRow label="Reste à charge" value={formatMontant(ligne.resteACharge)} /> : null}
        {ligne.tauxRemboursement != null ? <DetailRow label="Taux appliqué" value={`${ligne.tauxRemboursement}%`} /> : null}
        {ligne.franchise != null ? <DetailRow label="Franchise" value={formatMontant(ligne.franchise)} /> : null}
        {ligne.plafondApplique != null ? <DetailRow label="Plafond appliqué" value={formatMontant(ligne.plafondApplique)} /> : null}
        {ligne.statutControleMedical ? <DetailRow label="Contrôle médical" value={ligne.statutControleMedical} /> : null}
        {ligne.motifRejet ? <DetailRow label="Motif de rejet" value={ligne.motifRejet} color={colors.danger} /> : null}
        {ligne.nSinistre ? <DetailRow label="N° sinistre" value={ligne.nSinistre} /> : null}
        {ligne.natureMaladie ? <DetailRow label="Nature" value={ligne.natureMaladie} /> : null}
      </Card>

      <View style={{ gap: spacing.sm }}>
        {ligneDecompte.factureId ? (
          <PrimaryButton
            label="Décompte"
            icon="document-text-outline"
            variant="outline"
            onPress={() => ouvrir("Décompte", cheminDecompte(ligneDecompte.id))}
          />
        ) : null}
        {formulaire === "soins" ? (
          <PrimaryButton
            label="Feuille de soins"
            icon="document-text-outline"
            variant="outline"
            onPress={() => ouvrir("Feuille de soins", cheminFeuilleSoins(ligne.id))}
          />
        ) : null}
        {formulaire === "examen" ? (
          <PrimaryButton
            label="Feuille d'examen"
            icon="document-text-outline"
            variant="outline"
            onPress={() => ouvrir("Feuille d'examen", cheminFeuilleExamen(ligne.id))}
          />
        ) : null}
      </View>

      {groupe ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.sousTitre}>Actes de cette facture ({ligne.lignes!.length})</Text>
          {ligne.lignes!.map((item) => {
            const type = typeFormulaire(item.acteFamille);
            return (
              <View key={item.id} style={styles.sousLigne}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sousLigneTitre} numberOfLines={1}>{item.acteLibelle ?? item.type}</Text>
                  <Text style={styles.sousLigneMontant}>
                    {formatMontant(item.montant)}{item.baseRemboursement != null ? ` · remboursé ${formatMontant(item.baseRemboursement)}` : ""}
                  </Text>
                </View>
                {type ? (
                  <PrimaryButton
                    label={type === "soins" ? "Feuille de soins" : "Feuille d'examen"}
                    variant="outline"
                    onPress={() => ouvrir(
                      type === "soins" ? "Feuille de soins" : "Feuille d'examen",
                      type === "soins" ? cheminFeuilleSoins(item.id) : cheminFeuilleExamen(item.id),
                    )}
                  />
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  montant: { fontSize: 22, fontWeight: "800", fontFamily: "monospace", marginBottom: spacing.md },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { fontSize: 12.5, color: colors.textMuted },
  detailValue: { fontSize: 12.5, color: colors.text, fontWeight: "600", textAlign: "right", flexShrink: 1, marginLeft: spacing.md },
  sousTitre: { fontSize: 12.5, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  sousLigne: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  sousLigneTitre: { fontSize: 13, fontWeight: "600", color: colors.text },
  sousLigneMontant: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, fontFamily: "monospace" },
});

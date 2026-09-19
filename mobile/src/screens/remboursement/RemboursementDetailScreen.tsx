import { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../../navigation/types";
import {
  Screen, ScreenHeader, Card, SectionTitle, Badge, statutVariant,
  LoadingView, ErrorView, formatMontant, formatDate,
} from "../../components/ui";
import { colors, spacing } from "../../theme/colors";
import { getMesPrisesEnCharge, type MembrePriseEnCharge } from "../../api/portailMembre";
import { messageErreur } from "../../api/http";

// Détail d'une demande de remboursement (route "RemboursementDetail", { id }).
// Pas d'endpoint GET/:id dédié côté backend : on recharge la liste complète
// (modePaiement=Remboursement) et on retrouve la ligne par id.
function InfoLine({ label, value, emphasis, danger }: { label: string; value: string; emphasis?: boolean; danger?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, emphasis && styles.infoValueEmphasis, danger && styles.infoValueDanger]}>{value}</Text>
    </View>
  );
}

function PieceJointeLine({ label, present, last }: { label: string; present: boolean; last?: boolean }) {
  return (
    <View style={[styles.docRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.docLabel}>{label}</Text>
      {present ? (
        <View style={styles.docOk}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.docOkText}>Transmis</Text>
        </View>
      ) : (
        <Text style={styles.docManquant}>Non fourni</Text>
      )}
    </View>
  );
}

export function RemboursementDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "RemboursementDetail">>();
  const { id } = route.params;
  const [ligne, setLigne] = useState<MembrePriseEnCharge | null>(null);
  const [error, setError] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setError(null);
    try {
      const data = await getMesPrisesEnCharge("Remboursement");
      const trouve = data.find((l) => l.id === id) ?? null;
      setLigne(trouve);
      if (!trouve) setError("Cette demande est introuvable.");
    } catch (err) {
      setError(messageErreur(err, "Chargement impossible."));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  if (ligne === null && !error) {
    return (
      <Screen>
        <ScreenHeader title="Détail du remboursement" />
        <LoadingView />
      </Screen>
    );
  }

  if (!ligne) {
    return (
      <Screen>
        <ScreenHeader title="Détail du remboursement" />
        <ErrorView message={error ?? "Cette demande est introuvable."} onRetry={charger} />
      </Screen>
    );
  }

  const estRejete = ligne.statut.toLowerCase().includes("rejet") || ligne.statut.toLowerCase().includes("refus");

  return (
    <Screen>
      <ScreenHeader title={ligne.type || "Remboursement"} subtitle={ligne.prestataire} />

      <Card>
        <View style={styles.headerRow}>
          <Badge label={ligne.statut} variant={statutVariant(ligne.statut)} />
          <Text style={styles.dateText}>{formatDate(ligne.date)}</Text>
        </View>
        {ligne.acteLibelle ? <Text style={styles.description}>{ligne.acteLibelle}</Text> : null}
      </Card>

      <SectionTitle>Montants</SectionTitle>
      <Card>
        <InfoLine label="Frais réels" value={formatMontant(ligne.montant)} />
        {ligne.baseRemboursement != null ? <InfoLine label="Base de remboursement" value={formatMontant(ligne.baseRemboursement)} emphasis /> : null}
        {ligne.resteACharge != null ? <InfoLine label="Reste à charge" value={formatMontant(ligne.resteACharge)} /> : null}
      </Card>

      {ligne.statutControleMedical ? (
        <>
          <SectionTitle>Contrôle médical</SectionTitle>
          <Card>
            <InfoLine label="Statut" value={ligne.statutControleMedical} />
          </Card>
        </>
      ) : null}

      {ligne.motifRejet ? (
        <>
          <SectionTitle>Motif de rejet</SectionTitle>
          <Card>
            <Text style={estRejete ? styles.motifDanger : styles.motif}>{ligne.motifRejet}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Pièces jointes</SectionTitle>
      <Card>
        <PieceJointeLine label="Prescription médicale" present={!!ligne.prescriptionFichier} />
        <PieceJointeLine label="Facture normalisée" present={!!ligne.factureFichier} />
        <PieceJointeLine label="Quittance" present={!!ligne.quittanceFichier} />
        <PieceJointeLine label="Autre document" present={!!ligne.autreFichier} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  dateText: { fontSize: 12.5, color: colors.textMuted },
  description: { fontSize: 13.5, color: colors.text, lineHeight: 19 },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13.5, color: colors.text, fontWeight: "600" },
  infoValueEmphasis: { color: colors.success, fontWeight: "700" },
  infoValueDanger: { color: colors.danger, fontWeight: "700" },
  motif: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  motifDanger: { fontSize: 13.5, color: colors.danger, lineHeight: 19 },
  docRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  docLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  docOk: { flexDirection: "row", alignItems: "center", gap: 4 },
  docOkText: { fontSize: 12, color: colors.success, fontWeight: "600" },
  docManquant: { fontSize: 12, color: colors.textSubtle },
});

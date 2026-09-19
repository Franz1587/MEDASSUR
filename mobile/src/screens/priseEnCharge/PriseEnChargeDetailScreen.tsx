import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../../navigation/types";
import {
  Screen, ScreenHeader, Card, SectionTitle, Badge, statutVariant, PrimaryButton,
  LoadingView, ErrorView, formatMontant, formatDate,
} from "../../components/ui";
import { colors, spacing } from "../../theme/colors";
import {
  getMesPrisesEnChargePrealables, uploaderDocumentAccordPrealable, cheminCertificatAccordPrealable,
  type MembreAccordPrealable, type TypeDocumentAccordPrealable,
} from "../../api/portailMembre";
import { messageErreur, type RnFilePart } from "../../api/http";
import { marquerVu } from "../../utils/vus";

// Détail d'une demande de prise en charge (route "AccordDetail", { id }).
// Pas d'endpoint GET/:id dédié côté backend (voir
// PortailMembreController — seul findAll existe) : on recharge la liste
// complète et on retrouve le dossier par id, comme le ferait le web.
async function choisirFichier(): Promise<RnFilePart | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Ajouter un document",
      "Photo prise sur le champ, ou fichier existant (PDF, image…).",
      [
        {
          text: "Prendre une photo",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { resolve(null); return; }
            const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (res.canceled || !res.assets?.[0]) { resolve(null); return; }
            const a = res.assets[0];
            resolve({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
          },
        },
        {
          text: "Choisir un fichier",
          onPress: async () => {
            const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (res.canceled || !res.assets?.[0]) { resolve(null); return; }
            const a = res.assets[0];
            resolve({ uri: a.uri, name: a.name ?? `document-${Date.now()}`, type: a.mimeType ?? "application/octet-stream" });
          },
        },
        { text: "Annuler", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

function InfoLine({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, emphasis && styles.infoValueEmphasis]}>{value}</Text>
    </View>
  );
}

// Toujours modifiable, même une fois transmis (2026-09) — voir demande
// utilisateur : "je remarque que la prise en charge... n'est pas éditable,
// ce qui fait que même si il faut envoyer les bonnes pièces on ne peut pas
// le faire" — cas concret : Ariana signale que le document déposé comme
// "ordonnance" est en réalité un autre document, mais l'assuré n'avait
// aucun moyen de le RE-déposer (le bouton "Ajouter" disparaissait dès
// qu'un fichier — même le mauvais — était présent). Le bouton reste donc
// affiché en permanence ("Remplacer" une fois fourni), la coche verte ne
// devenant qu'un simple indicateur de statut à côté, plus une condition
// qui masque l'action.
function DocLine({
  label, fourni, envoi, onPress, last,
}: { label: string; fourni: boolean; envoi: boolean; onPress: () => void; last?: boolean }) {
  return (
    <View style={[styles.docRow, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
        {fourni ? <Ionicons name="checkmark-circle" size={16} color={colors.success} /> : null}
        <View>
          <Text style={styles.docLabel}>{label}</Text>
          <Text style={fourni ? styles.docStatutOk : styles.docStatutManquant}>{fourni ? "Transmis" : "Non fourni"}</Text>
        </View>
      </View>
      <PrimaryButton
        label={envoi ? "Envoi…" : fourni ? "Remplacer" : "Ajouter"}
        onPress={onPress}
        loading={envoi}
        variant="outline"
        icon="cloud-upload-outline"
      />
    </View>
  );
}

export function PriseEnChargeDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "AccordDetail">>();
  const { id } = route.params;
  const [dossier, setDossier] = useState<MembreAccordPrealable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envoiOrdonnance, setEnvoiOrdonnance] = useState(false);
  const [envoiDevis, setEnvoiDevis] = useState(false);

  const charger = useCallback(async () => {
    setError(null);
    try {
      const data = await getMesPrisesEnChargePrealables();
      const trouve = data.find((d) => d.id === id) ?? null;
      setDossier(trouve);
      // Bulle de compteur (2026-09) — voir demande utilisateur : une fois
      // ce dossier ouvert/consulté, il ne doit plus compter dans la bulle
      // "nouveau" de l'accès rapide/de la barre du bas (voir MainTabs.tsx,
      // DashboardScreen.tsx).
      if (trouve) marquerVu("priseEnCharge", trouve.id).catch(() => undefined);
      if (!trouve) setError("Ce dossier est introuvable.");
    } catch (err) {
      setError(messageErreur(err, "Chargement impossible."));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const uploader = async (type: TypeDocumentAccordPrealable) => {
    const fichier = await choisirFichier();
    if (!fichier) return;
    const setEnvoi = type === "ordonnance" ? setEnvoiOrdonnance : setEnvoiDevis;
    setEnvoi(true);
    try {
      await uploaderDocumentAccordPrealable(id, type, fichier);
      await charger();
    } catch (err) {
      Alert.alert("Envoi impossible", messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrirCertificat = () => {
    navigation.navigate("DocumentViewer", { path: cheminCertificatAccordPrealable(id), titre: "Certificat de prise en charge" });
  };

  if (dossier === null && !error) {
    return (
      <Screen>
        <ScreenHeader title="Détail de la demande" />
        <LoadingView />
      </Screen>
    );
  }

  if (!dossier) {
    return (
      <Screen>
        <ScreenHeader title="Détail de la demande" />
        <ErrorView message={error ?? "Ce dossier est introuvable."} onRetry={charger} />
      </Screen>
    );
  }

  const montantDevisNum = dossier.montantDevis != null ? Number(dossier.montantDevis) : null;
  const montantAutoriseNum = dossier.montantAutorise != null ? Number(dossier.montantAutorise) : null;
  const decisionBasse = dossier.decision.toLowerCase();
  const estRejete = decisionBasse.includes("rejet") || decisionBasse.includes("refus");

  return (
    <Screen>
      <ScreenHeader title={dossier.type} subtitle={dossier.prestataire} />

      <Card>
        <View style={styles.headerRow}>
          <Badge label={dossier.decision} variant={statutVariant(dossier.decision)} />
          <Text style={styles.dateText}>{formatDate(dossier.dateDemande)}</Text>
        </View>
        {dossier.description ? <Text style={styles.description}>{dossier.description}</Text> : null}
      </Card>

      <SectionTitle>Suivi du dossier</SectionTitle>
      <Card>
        <InfoLine label="Analyse médicale" value={dossier.statutAnalyseMedicale} />
        <InfoLine label="Validation financière" value={dossier.statutValidationFinanciere} />
        {dossier.dateValidite ? <InfoLine label="Valable jusqu'au" value={formatDate(dossier.dateValidite)} /> : null}
      </Card>

      {(montantDevisNum != null || montantAutoriseNum != null) && (
        <>
          <SectionTitle>Montants</SectionTitle>
          <Card>
            {montantDevisNum != null ? <InfoLine label="Montant du devis" value={formatMontant(montantDevisNum)} /> : null}
            {montantAutoriseNum != null ? <InfoLine label="Montant autorisé" value={formatMontant(montantAutoriseNum)} emphasis /> : null}
          </Card>
        </>
      )}

      {dossier.lignes && dossier.lignes.length > 0 && (
        <>
          <SectionTitle>Actes du devis</SectionTitle>
          <Card>
            {dossier.lignes.map((l) => (
              <View key={l.id} style={styles.ligneRow}>
                <Text style={styles.ligneLabel} numberOfLines={2}>{l.description}</Text>
                <Text style={styles.ligneMontant}>{formatMontant(l.montantDevis)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {dossier.motifDecision ? (
        <>
          <SectionTitle>Motif de la décision</SectionTitle>
          <Card>
            <Text style={estRejete ? styles.motifDanger : styles.motif}>{dossier.motifDecision}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Pièces jointes</SectionTitle>
      <Card>
        <DocLine label="Ordonnance" fourni={!!dossier.ordonnanceFichier} envoi={envoiOrdonnance} onPress={() => uploader("ordonnance")} />
        <DocLine label="Devis" fourni={!!dossier.devisFichier} envoi={envoiDevis} onPress={() => uploader("devis")} last />
      </Card>

      {dossier.decision === "Accordé" && (
        <PrimaryButton label="Certificat de prise en charge" icon="document-text-outline" onPress={ouvrirCertificat} />
      )}
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
  infoValueEmphasis: { color: colors.primary, fontWeight: "700" },
  ligneRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  ligneLabel: { flex: 1, fontSize: 13, color: colors.text },
  ligneMontant: { fontSize: 13, fontWeight: "700", color: colors.text },
  motif: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  motifDanger: { fontSize: 13.5, color: colors.danger, lineHeight: 19 },
  docRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  docLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  docStatutOk: { fontSize: 12, color: colors.success, marginTop: 2 },
  docStatutManquant: { fontSize: 12, color: colors.textSubtle, marginTop: 2 },
});

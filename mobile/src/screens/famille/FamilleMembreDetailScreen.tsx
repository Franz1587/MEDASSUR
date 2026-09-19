import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, ScreenHeader, Card, Badge, LoadingView, ErrorView, formatDate } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { API_URL, messageErreur } from "../../api/http";
import { getMoi, getMaFamille, type MembreIdentite, type MembreFamilleMembre } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

// Fiche détaillée d'un bénéficiaire (soi-même ou ayant droit) — MÊME champs
// que le détail dépliable de src/features/portail-membre/Famille.tsx côté
// web. Pas d'endpoint dédié : on recompose depuis getMoi()+getMaFamille().
const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint(e)", EF: "Enfant" };

function photoUrl(photo?: string | null): string | undefined {
  if (!photo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/photos/${photo}`;
}

interface Fiche {
  id: string;
  nom: string;
  prenom: string | null;
  typeAssure: string | null;
  matricule: string;
  statutCarte: string | null;
  photo?: string | null;
  telephone?: string | null;
  email?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  dateAffiliation?: string | null;
  nationalite?: string | null;
  lieuNaissance?: string | null;
  dateNaissance?: string | null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function FamilleMembreDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "FamilleMembreDetail">>();
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [moi, famille] = await Promise.all([getMoi(), getMaFamille()]);
      const trouve = moi.id === route.params.id
        ? { ...moi, typeAssure: moi.typeAssure ?? "AS", statutCarte: moi.statutCarte }
        : famille.find((m) => m.id === route.params.id);
      if (!trouve) { setError("Ce bénéficiaire est introuvable."); return; }
      setFiche(trouve as Fiche);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger la fiche."));
    } finally {
      setLoading(false);
    }
  }, [route.params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Fiche du bénéficiaire" />
        <LoadingView label="Chargement…" />
      </Screen>
    );
  }

  if (error || !fiche) {
    return (
      <Screen>
        <ScreenHeader title="Fiche du bénéficiaire" />
        <ErrorView message={error ?? "Bénéficiaire introuvable."} onRetry={load} />
      </Screen>
    );
  }

  const url = photoUrl(fiche.photo);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {url ? <Image source={{ uri: url }} style={styles.avatarImg} /> : <Ionicons name="person" size={32} color={colors.primary} />}
        </View>
        <Text style={styles.nom}>{fiche.nom} {fiche.prenom ?? ""}</Text>
        <Text style={styles.type}>{LABEL_TYPE[fiche.typeAssure ?? ""] ?? fiche.typeAssure ?? "—"}</Text>
        {fiche.statutCarte ? (
          <View style={{ marginTop: spacing.sm }}>
            <Badge label={fiche.statutCarte} variant={fiche.statutCarte === "Active" ? "success" : "neutral"} />
          </View>
        ) : null}
      </View>

      <Card>
        <DetailRow label="Matricule" value={fiche.matricule} />
        <DetailRow label="Date de naissance" value={formatDate(fiche.dateNaissance)} />
        {fiche.telephone ? <DetailRow label="Téléphone" value={fiche.telephone} /> : null}
        {fiche.email ? <DetailRow label="Email" value={fiche.email} /> : null}
        {fiche.sexe ? <DetailRow label="Sexe" value={fiche.sexe} /> : null}
        {fiche.adresse ? <DetailRow label="Adresse" value={fiche.adresse} /> : null}
        {fiche.lieuNaissance ? <DetailRow label="Lieu de naissance" value={fiche.lieuNaissance} /> : null}
        {fiche.nationalite ? <DetailRow label="Nationalité" value={fiche.nationalite} /> : null}
        {fiche.dateAffiliation ? <DetailRow label="Affilié(e) depuis" value={formatDate(fiche.dateAffiliation)} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: spacing.sm,
  },
  avatarImg: { width: 76, height: 76 },
  nom: { fontSize: 18, fontWeight: "800", color: colors.text },
  type: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { fontSize: 12.5, color: colors.textMuted },
  value: { fontSize: 12.5, color: colors.text, fontWeight: "600", textAlign: "right", flexShrink: 1, marginLeft: spacing.md },
});

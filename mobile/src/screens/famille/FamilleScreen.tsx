import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen, ScreenHeader, Badge, EmptyState, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { API_URL, messageErreur } from "../../api/http";
import { getMoi, getMaFamille, type MembreIdentite, type MembreFamilleMembre } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

// Ma famille — liste l'assuré principal ET ses ayants droit, MÊME logique
// que src/features/portail-membre/Famille.tsx côté web. Tap → fiche détaillée
// (FamilleMembreDetail), y compris pour soi-même.
const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint(e)", EF: "Enfant" };

// URL publique d'une photo uploadée — même règle que assurePhotoUrl() côté
// web (src/services/sante.service.ts), pas de helper équivalent exposé côté
// mobile/src/api : reproduit ici localement plutôt que de modifier http.ts.
function photoUrl(photo?: string | null): string | undefined {
  if (!photo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/photos/${photo}`;
}

export interface Personne {
  id: string;
  nom: string;
  prenom: string | null;
  typeAssure: string | null;
  statut: string;
  photo?: string | null;
}

export function FamilleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [membres, setMembres] = useState<MembreFamilleMembre[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [m, f] = await Promise.all([getMoi(), getMaFamille()]);
      setMoi(m);
      setMembres(f);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger votre famille."));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !moi) {
    return (
      <Screen>
        <ScreenHeader title="Ma famille" />
        <LoadingView label="Chargement de votre famille…" />
      </Screen>
    );
  }

  if (error && !moi) {
    return (
      <Screen>
        <ScreenHeader title="Ma famille" />
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  const personnes: Personne[] = moi
    ? [
        { id: moi.id, nom: moi.nom, prenom: moi.prenom, typeAssure: moi.typeAssure ?? "AS", statut: "Actif", photo: moi.photo },
        ...(membres ?? []).map((m) => ({ id: m.id, nom: m.nom, prenom: m.prenom, typeAssure: m.typeAssure, statut: m.statut, photo: m.photo })),
      ]
    : [];

  return (
    <Screen onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenHeader title="Ma famille" subtitle="Vous et vos ayants droit rattachés à ce contrat" />

      {personnes.length === 0 ? (
        <EmptyState icon="people-outline" title="Aucun bénéficiaire" />
      ) : (
        personnes.map((p) => {
          const url = photoUrl(p.photo);
          return (
            <Pressable
              key={p.id}
              onPress={() => navigation.navigate("FamilleMembreDetail", { id: p.id })}
              style={({ pressed }) => [styles.card, pressed ? { opacity: 0.7 } : null]}
            >
              <View style={styles.avatar}>
                {url ? <Image source={{ uri: url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={colors.primary} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.nom} numberOfLines={1}>{`${p.nom} ${p.prenom ?? ""}`.trim()}</Text>
                <Text style={styles.sous}>{LABEL_TYPE[p.typeAssure ?? ""] ?? p.typeAssure ?? "—"}</Text>
              </View>
              <Badge label={p.statut} variant={p.statut === "Actif" ? "success" : "neutral"} />
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  avatar: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40 },
  nom: { fontSize: 14, fontWeight: "700", color: colors.text },
  sous: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

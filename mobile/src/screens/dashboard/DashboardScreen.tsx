import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  Screen, Card, SectionTitle, ListRow, IconTile, Badge,
  LoadingView, ErrorView, formatMontant, formatDate,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import { getMembreDashboard, getMoi, getMesPrisesEnChargePrealables, type MembreDashboard } from "../../api/portailMembre";
import { getNonLus } from "../../api/messagerie";
import { compterNonVus } from "../../utils/vus";
import { API_URL, messageErreur } from "../../api/http";
import type { RootStackParamList, MainTabParamList } from "../../navigation/types";

// URL publique d'une photo uploadée — même règle que assurePhotoUrl() côté
// web / photoUrl() dans FamilleScreen.tsx.
function photoUrl(photo?: string | null): string | undefined {
  if (!photo) return undefined;
  return `${API_URL.replace(/\/api\/?$/, "")}/uploads/photos/${photo}`;
}

// Accueil du portail assuré (tableau de bord) — MÊME logique que
// src/features/portail-membre/Dashboard.tsx côté web (statut de carte,
// tuiles d'accès rapide vers toutes les rubriques, résumé prise en charge /
// dernier remboursement, totaux + répartitions foyer ou soi-même selon
// estAssurePrincipal résolu côté serveur). Aucune valeur par défaut inventée
// si l'API échoue — voir LoadingView/ErrorView ci-dessous.
type DashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Accueil">,
  NativeStackNavigationProp<RootStackParamList>
>;

// "Main" (le conteneur d'onglets) n'expose pas ses écrans internes dans
// RootStackParamList (typé `undefined`) — navigation.navigate("Main", {
// screen }) est le seul moyen d'atteindre un onglet depuis ce niveau, mais
// TypeScript ne le sait pas sans modifier navigation/types.ts (hors
// périmètre). On isole la nécessité du cast à cet unique point d'appel.
function navigateToTab(navigation: DashboardNavigation, screen: keyof MainTabParamList) {
  (navigation.navigate as (name: "Main", params: { screen: keyof MainTabParamList }) => void)("Main", { screen });
}

const LABEL_STATUT: Record<string, string> = {
  Active: "Carte active",
  Suspendue: "Carte suspendue",
  Inactive: "Carte inactive",
};

// statutVariant() (kit UI partagé) reconnaît "actif" mais pas "active" (le
// statut réel renvoyé pour StatutCarte) — mapping dédié local, même logique
// que src/features/portail-membre/Carte.tsx côté web (Active → success).
function statutCarteVariant(statut: string): "success" | "warning" | "danger" | "neutral" {
  if (statut === "Active") return "success";
  if (statut === "Suspendue") return "warning";
  if (statut === "Inactive") return "danger";
  return "neutral";
}

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigation>();
  const { currentUser } = useAuth();
  const [data, setData] = useState<MembreDashboard | null>(null);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [messagesNonLus, setMessagesNonLus] = useState(0);
  // "Vu/non vu" (2026-09) — voir demande utilisateur : la bulle "Prise en
  // charge" ne doit plus refléter le simple statut "en attente" (qui ne
  // bouge pas quand on consulte) mais le nombre de dossiers "en attente"
  // jamais encore ouverts (voir utils/vus.ts, même logique que MainTabs.tsx).
  const [pecNonVues, setPecNonVues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [d, moi, nonLus, accords] = await Promise.all([
        getMembreDashboard(), getMoi(), getNonLus().catch(() => 0), getMesPrisesEnChargePrealables().catch(() => []),
      ]);
      setData(d);
      setPhoto(photoUrl(moi.photo));
      setMessagesNonLus(nonLus);
      const enAttente = accords.filter((a) => a.decision === "En attente").map((a) => a.id);
      setPecNonVues(await compterNonVus("priseEnCharge", enAttente));
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger le tableau de bord."));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <Screen>
        <LoadingView label="Chargement du tableau de bord…" />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  return (
    <Screen scroll onRefresh={() => load(true)} refreshing={refreshing} style={{ backgroundColor: colors.background }}>
      <LinearGradient colors={colors.gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.header}>
        <View style={styles.headerRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={22} color="#ffffffcc" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Bienvenue,</Text>
            <Text style={styles.nom}>{data?.nom ?? currentUser?.nom ?? "…"}</Text>
            {data?.statutCarte ? (
              <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
                <Badge label={LABEL_STATUT[data.statutCarte] ?? data.statutCarte} variant={statutCarteVariant(data.statutCarte)} />
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {/* Accès rapide (2026-09) — voir demande utilisateur : "il faut juste
          garder Ma carte, Prise en Charge, Remboursement, E-Carnet, Réseau
          de soins et Messagerie" — le reste (Mes garanties, Historique, Ma
          famille, Mon profil) reste atteignable depuis l'onglet "Plus"
          (voir PlusMenuScreen.tsx), rien n'est retiré de l'application,
          seulement de cette grille de raccourcis. */}
      <SectionTitle style={{ marginTop: spacing.lg }}>Accès rapide</SectionTitle>
      <View style={styles.tilesGrid}>
        <IconTile icon="card-outline" label="Ma carte" onPress={() => navigation.navigate("CarteMembre", { assureId: currentUser?.assureSanteId ?? "", nom: currentUser?.nom ?? "" })} />
        <IconTile icon="clipboard-outline" label="Prise en charge" color={colors.warning} badge={pecNonVues} onPress={() => navigateToTab(navigation, "PriseEnCharge")} />
        <IconTile icon="receipt-outline" label="Remboursement" color={colors.success} onPress={() => navigateToTab(navigation, "Remboursement")} />
        <IconTile icon="medkit-outline" label="E-carnet" onPress={() => navigateToTab(navigation, "Carnet")} />
        <IconTile icon="map-outline" label="Réseau de soins" color={colors.info} onPress={() => navigation.navigate("ReseauSoins")} />
        <IconTile icon="chatbubbles-outline" label="Messagerie" badge={messagesNonLus} onPress={() => navigation.navigate("MessagerieListe")} />
      </View>

      <View style={styles.row2}>
        <Card style={styles.halfCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="clipboard-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Prise en charge</Text>
          </View>
          <Text style={styles.cardBig}>{data?.priseEnChargeEnAttente ?? 0}</Text>
          <Text style={styles.cardSub}>demande(s) en attente</Text>
        </Card>

        <Card style={styles.halfCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Dernier remboursement</Text>
          </View>
          {data?.dernierRemboursement ? (
            <>
              <Text style={styles.cardSub}>{formatDate(data.dernierRemboursement.date)}</Text>
              {data.dernierRemboursement.baseRemboursement != null ? (
                <Text style={[styles.cardBig, { fontSize: 16, color: colors.success }]}>{formatMontant(data.dernierRemboursement.baseRemboursement)}</Text>
              ) : (
                <Text style={styles.cardSub}>En cours de traitement</Text>
              )}
            </>
          ) : (
            <Text style={styles.cardSub}>Aucune demande pour l'instant.</Text>
          )}
        </Card>
      </View>

      <SectionTitle>{data?.estAssurePrincipal ? "Consommation du foyer" : "Ma consommation"}</SectionTitle>
      <View style={styles.row2}>
        <Card style={styles.halfCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Total des soins</Text>
          </View>
          <Text style={[styles.cardBig, { fontSize: 16 }]}>{formatMontant(data?.totalConsommation)}</Text>
        </Card>
        <Card style={styles.halfCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="save-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Total remboursé</Text>
          </View>
          <Text style={[styles.cardBig, { fontSize: 16, color: colors.success }]}>{formatMontant(data?.totalRembourse)}</Text>
        </Card>
      </View>

      {data?.estAssurePrincipal && data.parBeneficiaire.length > 0 ? (
        <>
          <SectionTitle>Par bénéficiaire</SectionTitle>
          <Card style={{ padding: 0 }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {data.parBeneficiaire.map((b) => (
                <ListRow key={b.assureId} icon="person-outline" label={b.nom} right={<Text style={styles.rowMontant}>{formatMontant(b.total)}</Text>} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {data && data.parRubrique.length > 0 ? (
        <>
          <SectionTitle>Par rubrique</SectionTitle>
          <Card style={{ padding: 0 }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {data.parRubrique.map((r) => (
                <ListRow key={r.rubrique} icon="layers-outline" label={r.rubrique} right={<Text style={styles.rowMontant}>{formatMontant(r.total)}</Text>} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <View style={styles.footerNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSubtle} />
        <Text style={styles.footerNoteText}>Vos données ne sont visibles que par vous.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#ffffff55" },
  avatarPlaceholder: { backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" },
  welcome: { color: "#ffffffcc", fontSize: 13, fontWeight: "600" },
  nom: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  tilesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  row2: { flexDirection: "row", gap: spacing.md },
  halfCard: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  cardTitle: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  cardBig: { fontSize: 22, fontWeight: "800", color: colors.text },
  cardSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowMontant: { fontSize: 13, fontWeight: "700", color: colors.text },
  footerNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  footerNoteText: { fontSize: 11.5, color: colors.textSubtle },
});

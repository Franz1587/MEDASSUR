import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { LeafletMap } from "../../components/LeafletMap";
import {
  ScreenHeader, ListRow, Badge, statutVariant, EmptyState, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { getReseauSoins, type PrestataireReseau } from "../../api/reseauSoins";
import { messageErreur } from "../../api/http";
import { obtenirPositionActuelle, type Position } from "../../utils/position";
import { distanceKm, formaterDistance } from "../../utils/distance";
import type { RootStackParamList } from "../../navigation/types";

// Réseau de soins — MÊME logique que src/features/portail-membre/ReseauSoins.tsx
// (web) : la liste complète est chargée une fois, puis filtrée côté client
// par type/recherche (peu de volume, pas besoin d'aller-retour réseau à
// chaque frappe). Catégories dérivées des `type` réels renvoyés par le
// backend — jamais une liste figée qui ne correspondrait pas à la
// taxonomie MedAssur réelle.
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ReseauSoinsListScreen() {
  const navigation = useNavigation<Nav>();
  const [tous, setTous] = useState<PrestataireReseau[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [vueCarte, setVueCarte] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReseauSoins();
      setTous(data);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger le réseau de soins."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Position de l'utilisateur demandée dès l'ouverture de l'écran (2026-09)
  // — voir demande utilisateur : "l'application doit être capable de nous
  // dire précisément quelles sont les prestataires qui sont vraiment à
  // proximité par rapport à ma position". Sert à la fois au tri de la liste
  // (nom → distance croissante dès que connue) et à la carte.
  useEffect(() => { obtenirPositionActuelle().then(setPosition); }, []);

  const types = useMemo(() => {
    const compteurs = new Map<string, number>();
    for (const p of tous ?? []) compteurs.set(p.type, (compteurs.get(p.type) ?? 0) + 1);
    return [...compteurs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tous]);

  // Distance à la position de l'utilisateur (2026-09) — voir demande
  // utilisateur ci-dessus. Un prestataire sans coordonnées n'a simplement
  // pas de distance connue (jamais une valeur inventée) — repoussé en fin
  // de liste, jamais mélangé au hasard parmi les distances réelles.
  const distancePour = useCallback((p: PrestataireReseau): number | null => (
    position && p.latitude != null && p.longitude != null
      ? distanceKm(position, { latitude: p.latitude, longitude: p.longitude })
      : null
  ), [position]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const base = (tous ?? []).filter((p) => {
      if (type && p.type !== type) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""} ${p.ville}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!position) return base.sort((a, b) => a.nom.localeCompare(b.nom));
    return base.sort((a, b) => {
      const da = distancePour(a);
      const db = distancePour(b);
      if (da === null && db === null) return a.nom.localeCompare(b.nom);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [tous, type, recherche, position, distancePour]);

  const avecCoordonnees = useMemo(
    () => filtres.filter((p) => p.latitude != null && p.longitude != null),
    [filtres],
  );

  if (loading && !tous) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.headerWrap}><ScreenHeader title="Réseau de soins" /></View>
        <LoadingView label="Chargement du réseau de soins…" />
      </SafeAreaView>
    );
  }

  if (error && !tous) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.headerWrap}><ScreenHeader title="Réseau de soins" /></View>
        <ErrorView message={error} onRetry={load} />
      </SafeAreaView>
    );
  }

  const peutAfficherCarte = avecCoordonnees.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.headerWrap}>
        <ScreenHeader
          title="Réseau de soins"
          subtitle={position ? "Triés par proximité" : "Prestataires conventionnés"}
          right={peutAfficherCarte ? (
            <View style={styles.toggleRow}>
              <Pressable onPress={() => setVueCarte(false)} style={[styles.toggleBtn, !vueCarte && styles.toggleBtnActive]}>
                <Ionicons name="list-outline" size={16} color={!vueCarte ? "#fff" : colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => setVueCarte(true)} style={[styles.toggleBtn, vueCarte && styles.toggleBtnActive]}>
                <Ionicons name="map-outline" size={16} color={vueCarte ? "#fff" : colors.textMuted} />
              </Pressable>
            </View>
          ) : undefined}
        />

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textSubtle} />
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Rechercher un nom, une ville…"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
          />
        </View>

        <FlatList
          horizontal
          data={[["", "Tous"] as [string, string], ...types.map(([t, n]) => [t, `${t} (${n})`] as [string, string])]}
          keyExtractor={([t]) => t || "tous"}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item: [t, label] }) => {
            const actif = t === "" ? type === null : type === t;
            return (
              <Pressable onPress={() => setType(t === "" ? null : t)} style={[styles.chip, actif && styles.chipActive]}>
                <Text style={[styles.chipText, actif && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {filtres.length === 0 ? (
        <EmptyState icon="business-outline" title="Aucun prestataire" subtitle="Aucun prestataire ne correspond à ces critères." />
      ) : vueCarte && peutAfficherCarte ? (
        <LeafletMap
          style={styles.map}
          position={position}
          points={avecCoordonnees.map((p) => ({
            id: p.id,
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            titre: p.nom,
            description: `${p.type}${p.ville ? ` · ${p.ville}` : ""}`,
          }))}
          onMarkerPress={(id) => navigation.navigate("ReseauSoinsDetail", { id })}
        />
      ) : (
        <FlatList
          data={filtres}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: p }) => {
            const d = distancePour(p);
            return (
              <ListRow
                icon="business-outline"
                label={`${p.titre ? `${p.titre} ` : ""}${p.nom}`}
                sublabel={`${p.specialite ? `${p.specialite} · ` : ""}${p.ville}`}
                onPress={() => navigation.navigate("ReseauSoinsDetail", { id: p.id })}
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {d != null ? <Text style={styles.distanceText}>{formaterDistance(d)}</Text> : null}
                    <Badge label={p.statutConvention} variant={statutVariant(p.statutConvention)} />
                    <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
                  </View>
                }
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  toggleRow: { flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, padding: 3, gap: 2 },
  toggleBtn: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  toggleBtnActive: { backgroundColor: colors.primary },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, height: 42, backgroundColor: colors.surface, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  chipsRow: { gap: 8, paddingBottom: spacing.md },
  chip: {
    paddingHorizontal: 14, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 },
  map: { flex: 1 },
  distanceText: { fontSize: 11.5, fontWeight: "700", color: colors.primary },
});

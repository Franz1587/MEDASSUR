import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, FlatList, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  ScreenHeader, Card, EmptyState, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { getMedecinsReseau, type MedecinReseau } from "../../api/reseauSoins";
import { messageErreur } from "../../api/http";

// Répertoire des médecins du réseau — parité avec VueMedecins dans
// src/features/portail-membre/ReseauSoins.tsx (web).
// Filtres : recherche texte libre + spécialité.
function titreComplet(m: MedecinReseau): string {
  const t = m.titre === "Professeur" ? "Pr " : m.titre === "Docteur" ? "Dr " : "";
  return `${t}${m.nom}${m.prenom ? ` ${m.prenom}` : ""}`;
}

export function ReseauSoinsMedecinsScreen() {
  const [medecins, setMedecins] = useState<MedecinReseau[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [specialite, setSpecialite] = useState<string | null>(null);
  const [selectionne, setSelectionne] = useState<MedecinReseau | null>(null);

  const charger = useCallback(async () => {
    setLoading(true); setError(null);
    try { setMedecins(await getMedecinsReseau()); }
    catch (err) { setError(messageErreur(err, "Impossible de charger le répertoire des médecins.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const specialites = useMemo(() => {
    const s = new Set<string>();
    for (const m of medecins ?? []) if (m.specialite) s.add(m.specialite);
    return [...s].sort((a, b) => a.localeCompare(b, "fr"));
  }, [medecins]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (medecins ?? []).filter((m) => {
      if (specialite && m.specialite !== specialite) return false;
      if (q && !titreComplet(m).toLowerCase().includes(q) &&
        !(m.specialite ?? "").toLowerCase().includes(q) &&
        !m.prestataires.some((p) => p.nom.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [medecins, recherche, specialite]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScreenHeader title="Médecins" subtitle="Médecins intervenant dans le réseau de soins" />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Nom, spécialité, clinique…"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
          />
          {recherche ? (
            <Pressable onPress={() => setRecherche("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {specialites.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Pressable
            onPress={() => setSpecialite(null)}
            style={[styles.chip, !specialite && styles.chipActive]}
          >
            <Text style={[styles.chipText, !specialite && styles.chipTextActive]}>Toutes</Text>
          </Pressable>
          {specialites.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpecialite(specialite === s ? null : s)}
              style={[styles.chip, specialite === s && styles.chipActive]}
            >
              <Text style={[styles.chipText, specialite === s && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {error ? (
        <ErrorView message={error} onRetry={charger} />
      ) : loading ? (
        <LoadingView label="Chargement des médecins…" />
      ) : filtres.length === 0 ? (
        <EmptyState icon="person-outline" title="Aucun médecin" subtitle="Aucun médecin ne correspond à votre recherche." />
      ) : (
        <FlatList
          data={filtres}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item: m }) => (
            <Pressable onPress={() => setSelectionne(m)}>
              <Card style={styles.medecinCard}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medecinNom}>{titreComplet(m)}</Text>
                  {m.specialite ? <Text style={styles.medecinSpec}>{m.specialite}</Text> : null}
                  {m.prestataires.length > 0 ? (
                    <Text style={styles.medecinLieux} numberOfLines={1}>
                      {m.prestataires.map((p) => p.nom).join(" · ")}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Card>
            </Pressable>
          )}
        />
      )}

      {/* Modal détail médecin */}
      <Modal visible={!!selectionne} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectionne(null)}>
        {selectionne ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitre}>{titreComplet(selectionne)}</Text>
              <Pressable onPress={() => setSelectionne(null)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {selectionne.specialite ? (
                <View style={styles.infoRow}>
                  <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>{selectionne.specialite}</Text>
                </View>
              ) : null}
              {selectionne.telephone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoText}>{selectionne.telephone}</Text>
                </View>
              ) : null}
              {selectionne.prestataires.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Structures d'intervention</Text>
                  {selectionne.prestataires.map((p) => (
                    <View key={p.id} style={styles.prestataireLigne}>
                      <Ionicons name="business-outline" size={15} color={colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prestataireNom}>{p.nom}</Text>
                        <Text style={styles.prestataireVille}>{p.type}{p.ville ? ` · ${p.ville}` : ""}</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  chipsRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 8, flexDirection: "row" },
  chip: {
    paddingHorizontal: 12, height: 30, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  medecinCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center",
  },
  medecinNom: { fontSize: 14, fontWeight: "600", color: colors.text },
  medecinSpec: { fontSize: 12, color: colors.primary, marginTop: 1 },
  medecinLieux: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitre: { fontSize: 17, fontWeight: "700", color: colors.text, flex: 1, marginRight: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  infoText: { fontSize: 14, color: colors.text },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.sm },
  prestataireLigne: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: spacing.sm },
  prestataireNom: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  prestataireVille: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

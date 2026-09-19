import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Screen, ScreenHeader, Card, SectionTitle, Badge, statutVariant,
  EmptyState, LoadingView, ErrorView, formatMontant, formatDate,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import { getMesPrisesEnCharge, getMoi, getMaFamille, type MembrePriseEnCharge } from "../../api/portailMembre";
import { messageErreur } from "../../api/http";
import type { RootStackParamList } from "../../navigation/types";

// Historique de soins — MÊME logique que
// src/features/portail-membre/Historique.tsx côté web : couvre TOUT le
// foyer (getMesPrisesEnCharge() sans filtre modePaiement), rangé par
// exercice puis par rubrique, avec filtres bénéficiaire/rubrique.
interface Beneficiaire { id: string; nom: string }

function montantAffiche(l: MembrePriseEnCharge): { texte: string; remboursement: boolean } {
  // Remboursement : la part assurance (baseRemboursement) est ce qui est
  // réellement reversé — jamais les frais réels, voir mémoire projet.
  if (l.modePaiement === "Remboursement" && l.baseRemboursement != null) {
    return { texte: formatMontant(l.baseRemboursement), remboursement: true };
  }
  return { texte: formatMontant(l.montant), remboursement: false };
}

export function HistoriqueScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser } = useAuth();
  const [lignes, setLignes] = useState<MembrePriseEnCharge[] | null>(null);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beneficiaireId, setBeneficiaireId] = useState<string | null>(null);
  const [rubrique, setRubrique] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [ps, moi, famille] = await Promise.all([getMesPrisesEnCharge(), getMoi(), getMaFamille()]);
      setLignes(ps);
      setBeneficiaires([
        { id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim() },
        ...famille.map((m) => ({ id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() })),
      ]);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger votre historique."));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rubriques = useMemo(() => [...new Set((lignes ?? []).map((l) => l.rubrique))].sort(), [lignes]);

  const filtrees = useMemo(() => {
    return (lignes ?? []).filter((l) => {
      if (beneficiaireId && l.assureId !== beneficiaireId) return false;
      if (rubrique && l.rubrique !== rubrique) return false;
      return true;
    });
  }, [lignes, beneficiaireId, rubrique]);

  const groupesExercice = useMemo(() => {
    const parExercice = new Map<string, MembrePriseEnCharge[]>();
    for (const l of filtrees) {
      const cle = l.exercice != null ? `Exercice ${l.exercice}` : "Hors exercice";
      (parExercice.get(cle) ?? parExercice.set(cle, []).get(cle)!).push(l);
    }
    return [...parExercice.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([exercice, items]) => {
        const parRubrique = new Map<string, MembrePriseEnCharge[]>();
        for (const l of items) (parRubrique.get(l.rubrique) ?? parRubrique.set(l.rubrique, []).get(l.rubrique)!).push(l);
        return {
          exercice,
          rubriques: [...parRubrique.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, ls]) => ({ rubrique: r, lignes: ls })),
        };
      });
  }, [filtrees]);

  if (loading && !lignes) {
    return (
      <Screen>
        <ScreenHeader title="Historique de soins" />
        <LoadingView label="Chargement de votre historique…" />
      </Screen>
    );
  }

  if (error && !lignes) {
    return (
      <Screen>
        <ScreenHeader title="Historique de soins" />
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenHeader title="Historique de soins" subtitle="Tous les soins de votre foyer" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Tous les bénéficiaires" active={beneficiaireId === null} onPress={() => setBeneficiaireId(null)} />
        {(beneficiaires ?? []).map((b) => (
          <Chip
            key={b.id}
            label={b.id === currentUser?.assureSanteId ? `${b.nom} (vous)` : b.nom}
            active={beneficiaireId === b.id}
            onPress={() => setBeneficiaireId(b.id)}
          />
        ))}
      </ScrollView>

      {rubriques.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Toutes les rubriques" active={rubrique === null} onPress={() => setRubrique(null)} />
          {rubriques.map((r) => (
            <Chip key={r} label={r} active={rubrique === r} onPress={() => setRubrique(r)} />
          ))}
        </ScrollView>
      ) : null}

      {groupesExercice.length === 0 ? (
        <EmptyState icon="time-outline" title="Aucun soin enregistré" subtitle="Aucune prestation ne correspond à ces critères." />
      ) : (
        groupesExercice.map((g) => (
          <View key={g.exercice} style={{ marginBottom: spacing.lg }}>
            <SectionTitle>{g.exercice}</SectionTitle>
            {g.rubriques.map((r) => (
              <View key={r.rubrique} style={{ marginBottom: spacing.md }}>
                <Text style={styles.rubriqueLabel}>{r.rubrique}</Text>
                {r.lignes.map((l) => {
                  const groupe = (l.lignes?.length ?? 0) > 1;
                  const montant = montantAffiche(l);
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => navigation.navigate("HistoriqueDetail", { id: l.id })}
                      style={({ pressed }) => [styles.ligne, pressed ? { opacity: 0.7 } : null]}
                    >
                      <View style={styles.ligneTop}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.ligneTitreRow}>
                            <Text style={styles.ligneTitre} numberOfLines={1}>{l.type}</Text>
                            {l.assureId !== currentUser?.assureSanteId ? <Badge label={l.assureNom} variant="info" /> : null}
                            {groupe ? <Badge label={`${l.lignes!.length} actes`} variant="neutral" /> : null}
                          </View>
                          <Text style={styles.ligneSous} numberOfLines={1}>{l.prestataire} · {formatDate(l.date)}</Text>
                        </View>
                        <Badge label={l.statut} variant={statutVariant(l.statut)} />
                      </View>
                      <View style={styles.ligneBas}>
                        <Text style={styles.ligneModePaiement}>{l.modePaiement ?? "—"}</Text>
                        <Text style={[styles.ligneMontant, montant.remboursement ? { color: colors.success } : null]}>{montant.texte}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  rubriqueLabel: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 6 },
  ligne: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  ligneTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  ligneTitreRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  ligneTitre: { fontSize: 13.5, fontWeight: "700", color: colors.text, flexShrink: 1 },
  ligneSous: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  ligneBas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  ligneModePaiement: { fontSize: 12, color: colors.textMuted },
  ligneMontant: { fontSize: 13, fontWeight: "700", color: colors.text, fontFamily: "monospace" },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen, ScreenHeader, Card, ListRow, EmptyState, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { getMesGaranties, type MembreGarantie } from "../../api/portailMembre";
import { messageErreur } from "../../api/http";

// Mes garanties — lecture seule, MÊME logique que
// src/features/portail-membre/Garanties.tsx côté web : liste groupée par
// categorie (le taux affiché est déjà résolu côté serveur selon
// assuré/ayant droit — voir tauxApplicable dans MembreGarantie).
function libellePlafond(g: MembreGarantie): string {
  if (g.plafond) return g.plafond;
  if (g.plafondMontant != null) {
    const n = typeof g.plafondMontant === "string" ? parseFloat(g.plafondMontant) : g.plafondMontant;
    return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  }
  return "Sans plafond";
}

function libelleTaux(taux: MembreGarantie["tauxApplicable"]): string {
  if (taux == null) return "—";
  return `${taux}%`;
}

export function GarantiesScreen() {
  const [garanties, setGaranties] = useState<MembreGarantie[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getMesGaranties();
      setGaranties(data);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger vos garanties."));
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groupes = useMemo(() => {
    if (!garanties) return [];
    const categories = [...new Set(garanties.map((g) => g.categorie))];
    return categories.map((categorie) => ({
      categorie,
      lignes: garanties.filter((g) => g.categorie === categorie),
    }));
  }, [garanties]);

  if (loading && !garanties) {
    return (
      <Screen>
        <ScreenHeader title="Mes garanties" />
        <LoadingView label="Chargement de vos garanties…" />
      </Screen>
    );
  }

  if (error && !garanties) {
    return (
      <Screen>
        <ScreenHeader title="Mes garanties" />
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenHeader title="Mes garanties" subtitle="Taux de couverture et plafonds de votre contrat" />

      {groupes.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="Aucune garantie renseignée" subtitle="Votre contrat ne comporte aucune garantie pour l'instant." />
      ) : (
        groupes.map((g) => (
          <Card key={g.categorie} style={{ padding: 0, overflow: "hidden" }}>
            <View style={styles.groupHeader}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={styles.groupTitle}>{g.categorie}</Text>
            </View>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {g.lignes.map((l) => (
                <ListRow
                  key={l.id}
                  label={l.libelle}
                  sublabel={`${libelleTaux(l.tauxApplicable)} · ${libellePlafond(l)}${l.plafondPeriode ? ` / ${l.plafondPeriode}` : ""}`}
                />
              ))}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  groupTitle: { fontSize: 12.5, fontWeight: "700", color: colors.text, textTransform: "uppercase", letterSpacing: 0.4 },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen, ScreenHeader, Badge, EmptyState, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { ApiError, messageErreur } from "../../api/http";
import { getMembreDashboard, getDelegations, revoquerDelegation, type Delegation } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

const LABEL_TYPE: Record<string, string> = { CJ: "Conjoint(e)", EF: "Enfant" };

// Accès famille — réservé à l'assuré PRINCIPAL RACINE (voir
// getMembreDashboard().estAssurePrincipal). Le backend refuse aussi
// (403) si ce n'est pas le cas : on gère les deux, jamais d'écran cassé.
// MÊME logique que src/features/portail-membre/Delegations.tsx côté web.
export function DelegationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [membres, setMembres] = useState<Delegation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revocationEnCours, setRevocationEnCours] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await getMembreDashboard();
      if (!dashboard.estAssurePrincipal) {
        setAutorise(false);
        return;
      }
      setAutorise(true);
      const d = await getDelegations();
      setMembres(d);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setAutorise(false);
        return;
      }
      setError(messageErreur(err, "Impossible de charger les accès famille."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const revoquer = (m: Delegation) => {
    Alert.alert(
      "Révoquer l'accès",
      `Révoquer l'accès de ${m.nom} ${m.prenom ?? ""} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Révoquer", style: "destructive",
          onPress: async () => {
            setRevocationEnCours(m.id);
            try {
              await revoquerDelegation(m.id);
              load();
            } catch (err) {
              Alert.alert("Révocation impossible", messageErreur(err));
            } finally {
              setRevocationEnCours(null);
            }
          },
        },
      ],
    );
  };

  if (loading && autorise === null) {
    return (
      <Screen>
        <ScreenHeader title="Accès famille" />
        <LoadingView label="Chargement…" />
      </Screen>
    );
  }

  if (autorise === false) {
    return (
      <Screen>
        <ScreenHeader title="Accès famille" />
        <EmptyState
          icon="lock-closed-outline"
          title="Réservé à l'assuré principal"
          subtitle="Seul l'assuré principal du contrat peut donner ou gérer l'accès de ses ayants droit au portail."
        />
      </Screen>
    );
  }

  if (error && !membres) {
    return (
      <Screen>
        <ScreenHeader title="Accès famille" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={load} refreshing={loading}>
      <ScreenHeader title="Accès famille" subtitle="Donnez à vos ayants droit leur propre accès au portail" />

      {!membres || membres.length === 0 ? (
        <EmptyState icon="people-outline" title="Aucun ayant droit rattaché" />
      ) : (
        membres.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nom} numberOfLines={1}>{m.nom} {m.prenom ?? ""}</Text>
              <Text style={styles.sous}>{LABEL_TYPE[m.typeAssure ?? ""] ?? m.typeAssure ?? "—"} · {m.matricule}</Text>
              <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
                {m.compte ? (
                  <Badge label={`Accès actif · ${m.compte.modules.length} rubrique(s)`} variant="success" />
                ) : (
                  <Badge label="Aucun accès" variant="neutral" />
                )}
              </View>
            </View>
            <View style={styles.actions}>
              {m.compte ? (
                <>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate("DelegationGerer", { cibleId: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim(), modulesActuels: m.compte!.modules })}
                  >
                    <Ionicons name="key-outline" size={15} color={colors.primary} />
                    <Text style={styles.actionText}>Droits</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnDanger}
                    disabled={revocationEnCours === m.id}
                    onPress={() => revoquer(m)}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate("DelegationNouvelle", { cibleId: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() })}
                >
                  <Ionicons name="key-outline" size={15} color={colors.primary} />
                  <Text style={styles.actionText}>Donner accès</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
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
  nom: { fontSize: 14, fontWeight: "700", color: colors.text },
  sous: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  actionText: { fontSize: 11.5, fontWeight: "600", color: colors.primary },
  actionBtnDanger: {
    width: 30, height: 30, alignItems: "center", justifyContent: "center",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
});

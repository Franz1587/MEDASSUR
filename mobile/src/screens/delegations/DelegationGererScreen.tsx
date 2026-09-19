import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Screen, ScreenHeader, Card, FormField, PrimaryButton, LoadingView } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { messageErreur } from "../../api/http";
import { getModulesDisponiblesDelegation, modifierModulesDelegation, revoquerDelegation } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

// Gérer un accès existant — modifier les rubriques déléguées ou révoquer,
// MÊME logique que la modale "Modifier les droits" de
// src/features/portail-membre/Delegations.tsx côté web (canal et mot de
// passe déjà fixés à la première délégation, non modifiables depuis cet
// écran).
const LABEL_MODULE: Record<string, string> = {
  membreDashboard: "Accueil", membreCarte: "Ma carte", membreGaranties: "Mes garanties",
  membrePriseEnCharge: "Prise en charge", membreRemboursement: "Remboursement",
  membreReseauSoins: "Réseau de soins", membreCarnetSante: "E-carnet Santé",
  membreHistorique: "Historique de soins", membreFamille: "Ma famille", messagerie: "Messagerie",
};

export function DelegationGererScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DelegationGerer">>();
  const { cibleId, nom, modulesActuels } = route.params;

  const [modulesDisponibles, setModulesDisponibles] = useState<string[] | null>(null);
  const [modules, setModules] = useState<Set<string>>(new Set(modulesActuels));
  const [erreur, setErreur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    getModulesDisponiblesDelegation().then(setModulesDisponibles).catch(() => setModulesDisponibles([]));
  }, []);

  const toggleModule = (m: string) => setModules((v) => {
    const s = new Set(v);
    if (s.has(m)) s.delete(m); else s.add(m);
    return s;
  });

  const enregistrer = async () => {
    setErreur(null);
    setSubmitting(true);
    try {
      const modulesChoisis = (modulesDisponibles ?? []).filter((m) => modules.has(m));
      await modifierModulesDelegation(cibleId, modulesChoisis);
      Alert.alert("Droits mis à jour", undefined, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    } finally {
      setSubmitting(false);
    }
  };

  const revoquer = () => {
    Alert.alert("Révoquer l'accès", `Révoquer l'accès de ${nom} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Révoquer", style: "destructive",
        onPress: async () => {
          setRevoking(true);
          try {
            await revoquerDelegation(cibleId);
            navigation.goBack();
          } catch (err) {
            Alert.alert("Révocation impossible", messageErreur(err));
          } finally {
            setRevoking(false);
          }
        },
      },
    ]);
  };

  if (modulesDisponibles === null) {
    return (
      <Screen>
        <ScreenHeader title="Gérer l'accès" />
        <LoadingView label="Chargement…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Gérer l'accès" subtitle={nom} />

      <Card>
        <FormField label="Rubriques accessibles">
          {modulesDisponibles.length === 0 ? (
            <Text style={styles.info}>Aucune rubrique déléguable pour l'instant.</Text>
          ) : (
            modulesDisponibles.map((m) => {
              const checked = modules.has(m);
              return (
                <Pressable key={m} onPress={() => toggleModule(m)} style={styles.moduleRow}>
                  <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? colors.primary : colors.textSubtle} />
                  <Text style={styles.moduleLabel}>{LABEL_MODULE[m] ?? m}</Text>
                </Pressable>
              );
            })
          )}
        </FormField>
      </Card>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label="Enregistrer" onPress={enregistrer} loading={submitting} icon="checkmark-outline" />
        <PrimaryButton label="Révoquer l'accès" onPress={revoquer} loading={revoking} icon="trash-outline" variant="danger" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: 12, color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm },
  moduleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 9 },
  moduleLabel: { fontSize: 13.5, color: colors.text },
  erreur: { fontSize: 12.5, color: colors.danger, marginBottom: spacing.md },
});

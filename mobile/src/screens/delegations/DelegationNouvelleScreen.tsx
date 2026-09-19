import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Screen, ScreenHeader, Card, FormField, PrimaryButton, inputStyle, LoadingView } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { messageErreur } from "../../api/http";
import { accorderDelegation, getModulesDisponiblesDelegation, type AccorderDelegationInput } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

// Donner un accès — MÊME logique que la modale de
// src/features/portail-membre/Delegations.tsx côté web : choix du canal de
// connexion (matricule/email/téléphone), mot de passe initial (≥ 6
// caractères), sélection des rubriques accessibles (déjà filtrées côté
// serveur par getModulesDisponiblesDelegation() — jamais de liste figée
// côté client).
const LABEL_CANAL: Record<AccorderDelegationInput["identifiantType"], string> = {
  matricule: "Matricule", email: "Adresse email", telephone: "Numéro de téléphone",
};

// Libellés des rubriques déléguables — mêmes clés/labels que viewLabels
// (src/layout/navConfig.ts côté web, module hors périmètre mobile — voir
// mobile/src/utils/groupesActes.ts pour la logique de duplication assumée).
const LABEL_MODULE: Record<string, string> = {
  membreDashboard: "Accueil", membreCarte: "Ma carte", membreGaranties: "Mes garanties",
  membrePriseEnCharge: "Prise en charge", membreRemboursement: "Remboursement",
  membreReseauSoins: "Réseau de soins", membreCarnetSante: "E-carnet Santé",
  membreHistorique: "Historique de soins", membreFamille: "Ma famille", messagerie: "Messagerie",
};

export function DelegationNouvelleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DelegationNouvelle">>();
  const { cibleId, nom } = route.params;

  const [modulesDisponibles, setModulesDisponibles] = useState<string[] | null>(null);
  const [identifiantType, setIdentifiantType] = useState<AccorderDelegationInput["identifiantType"]>("matricule");
  const [identifiantValeur, setIdentifiantValeur] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [modules, setModules] = useState<Set<string>>(new Set(["membreDashboard"]));
  const [erreur, setErreur] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getModulesDisponiblesDelegation().then(setModulesDisponibles).catch(() => setModulesDisponibles([]));
  }, []);

  const toggleModule = (m: string) => setModules((v) => {
    const s = new Set(v);
    if (s.has(m)) s.delete(m); else s.add(m);
    return s;
  });

  const soumettre = async () => {
    setErreur(null);
    if (motDePasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if ((identifiantType === "email" || identifiantType === "telephone") && !identifiantValeur.trim()) {
      setErreur(`${LABEL_CANAL[identifiantType]} requis pour ce canal.`);
      return;
    }
    setSubmitting(true);
    try {
      const modulesChoisis = (modulesDisponibles ?? []).filter((m) => modules.has(m));
      await accorderDelegation(cibleId, {
        identifiantType,
        identifiantValeur: identifiantValeur.trim() || undefined,
        motDePasse,
        modules: modulesChoisis,
      });
      Alert.alert("Accès créé", `${nom} peut désormais se connecter au portail.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setErreur(messageErreur(err, "Opération impossible."));
    } finally {
      setSubmitting(false);
    }
  };

  if (modulesDisponibles === null) {
    return (
      <Screen>
        <ScreenHeader title="Donner un accès" />
        <LoadingView label="Chargement…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Donner un accès" subtitle={nom} />

      <Card>
        <FormField label="Se connecter par">
          <View style={styles.canalRow}>
            {(Object.keys(LABEL_CANAL) as AccorderDelegationInput["identifiantType"][]).map((c) => {
              const active = identifiantType === c;
              return (
                <Pressable key={c} onPress={() => setIdentifiantType(c)} style={[styles.canalBtn, active ? styles.canalBtnActive : null]}>
                  <Text style={[styles.canalText, active ? styles.canalTextActive : null]}>{LABEL_CANAL[c]}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormField>

        {identifiantType === "email" ? (
          <FormField label={`Adresse email de ${nom}`}>
            <TextInput
              value={identifiantValeur}
              onChangeText={setIdentifiantValeur}
              style={inputStyle.base}
              placeholder="exemple@gmail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>
        ) : identifiantType === "telephone" ? (
          <FormField label={`Numéro de téléphone de ${nom}`}>
            <TextInput
              value={identifiantValeur}
              onChangeText={setIdentifiantValeur}
              style={inputStyle.base}
              placeholder="+241 ..."
              keyboardType="phone-pad"
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>
        ) : (
          <Text style={styles.info}>La connexion se fera avec le matricule de {nom}.</Text>
        )}

        <FormField label="Mot de passe initial">
          <TextInput
            value={motDePasse}
            onChangeText={setMotDePasse}
            style={inputStyle.base}
            placeholder="6 caractères minimum"
            secureTextEntry
            placeholderTextColor={colors.textSubtle}
          />
        </FormField>
      </Card>

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

      <PrimaryButton label="Créer l'accès" onPress={soumettre} loading={submitting} icon="key-outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  canalRow: { flexDirection: "row", gap: spacing.sm },
  canalBtn: {
    flex: 1, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  canalBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
  canalText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  canalTextActive: { color: colors.primary },
  info: { fontSize: 12, color: colors.textMuted, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  moduleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 9 },
  moduleLabel: { fontSize: 13.5, color: colors.text },
  erreur: { fontSize: 12.5, color: colors.danger, marginBottom: spacing.md },
});

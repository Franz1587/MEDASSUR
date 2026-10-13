import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";
import { PrimaryButton } from "../../components/ui";

// Consentement RGPD mobile (2026-10) — miroir de
// src/features/consentement/ConsentementModal.tsx côté web. Affiché une
// SEULE fois au premier usage (via consentementDonne dans AuthContext, stocké
// en SecureStore). Trois profils : assuré / professionnel / client — seul
// "assure" sera rencontré en pratique sur l'app mobile (portail assuré
// uniquement), mais les trois sont présents pour parité avec le web.
const PROFIL_CONTENU: Record<string, { titre: string; icone: keyof typeof Ionicons.glyphMap; clauses: string[] }> = {
  assure: {
    titre: "Protection de vos données de santé",
    icone: "heart",
    clauses: [
      "Les données personnelles vous concernant (nom, prénom, date de naissance, coordonnées) sont collectées pour assurer la gestion de votre couverture santé.",
      "Vos données de santé (consultations, ordonnances, résultats d'examens, actes médicaux) sont traitées dans le strict respect du secret médical et uniquement pour la gestion de vos remboursements et prises en charge.",
      "Les données de vos ayants droit (conjoint, enfants) bénéficient des mêmes protections. Vous confirmez avoir leur accord pour leur inscription et le traitement de leurs données.",
      "Vos données sont conservées pendant la durée de votre couverture et 5 ans après la résiliation, conformément à la réglementation gabonaise.",
      "Vous bénéficiez d'un droit d'accès, de rectification et d'opposition à vos données auprès de votre société d'assurance.",
      "En cas de résiliation, l'accès à l'historique de vos données via la plateforme MEDASSUR+ peut être maintenu sur abonnement individuel annuel.",
    ],
  },
  professionnel: {
    titre: "Traitement de vos données professionnelles",
    icone: "medkit",
    clauses: [
      "Vos données professionnelles (nom, spécialité, numéro de convention, coordonnées de l'établissement) sont collectées pour gérer vos relations contractuelles avec les organismes assureurs.",
      "Les données de facturation et de prestations que vous saisissez sont transmises aux organismes assureurs concernés dans le cadre du tiers payant.",
      "Les prescriptions et actes médicaux enregistrés sur la plateforme sont couverts par le secret professionnel et ne sont accessibles qu'aux parties autorisées.",
      "Vous êtes responsable de la confidentialité des identifiants de connexion de votre établissement.",
      "Vos données sont conservées pendant la durée de votre convention et 10 ans après sa résiliation à des fins de contrôle et de traçabilité.",
    ],
  },
  client: {
    titre: "Traitement de vos données contractuelles",
    icone: "document-text",
    clauses: [
      "Les données de votre organisation (raison sociale, coordonnées, représentants légaux) sont collectées pour la gestion de votre contrat d'assurance collective.",
      "Les données de vos employés/membres affiliés sont traitées exclusivement dans le cadre de la gestion de leurs droits et remboursements.",
      "Vous confirmez être autorisé(e) à transmettre les données de vos affiliés à la plateforme MEDASSUR+ et à votre société d'assurance.",
      "Les données financières (cotisations, primes) sont conservées conformément aux obligations légales gabonaises en matière comptable.",
      "Vous disposez d'un droit d'accès et de rectification des données de votre organisation auprès de votre interlocuteur assureur.",
    ],
  },
};

function profilPourRole(roleId: string): keyof typeof PROFIL_CONTENU {
  if (roleId === "assure_principal") return "assure";
  if (roleId === "medecin_prescripteur" || roleId === "prestataire_sante") return "professionnel";
  return "client";
}

export function ConsentementScreen() {
  const { currentUser, accepterConsentement, logout } = useAuth();
  const [coche, setCoche] = useState(false);
  const [enCours, setEnCours] = useState(false);

  if (!currentUser) return null;

  const profil = profilPourRole(currentUser.roleId);
  const contenu = PROFIL_CONTENU[profil];

  const valider = async () => {
    if (!coche) return;
    setEnCours(true);
    try {
      await accepterConsentement();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* En-tête */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={contenu.icone} size={28} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.badgeRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={colors.primary} />
            <Text style={styles.badge}>CONSENTEMENT REQUIS</Text>
          </View>
          <Text style={styles.titre}>{contenu.titre}</Text>
          <Text style={styles.sousTitre}>
            Avant de continuer, lisez et acceptez les conditions de traitement de vos données.
          </Text>
        </View>
      </View>

      {/* Corps scrollable */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {contenu.clauses.map((clause, i) => (
          <View key={i} style={styles.clause}>
            <View style={styles.clauseNumero}>
              <Text style={styles.clauseNumeroText}>{i + 1}</Text>
            </View>
            <Text style={styles.clauseTexte}>{clause}</Text>
          </View>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteTexte}>
            Cette acceptation est enregistrée avec la date et l'heure de votre premier accès. Elle peut être consultée
            auprès de votre société d'assurance. Conformément à la loi gabonaise sur la protection des données
            personnelles, vous disposez d'un droit d'accès, de rectification et d'opposition à vos données.
          </Text>
        </View>
      </ScrollView>

      {/* Pied */}
      <View style={styles.footer}>
        <Pressable style={styles.checkRow} onPress={() => setCoche((v) => !v)}>
          <View style={[styles.checkbox, coche && styles.checkboxChecked]}>
            {coche && <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />}
          </View>
          <Text style={styles.checkLabel}>
            J'ai lu et j'accepte les conditions de traitement de mes données personnelles décrites ci-dessus.
          </Text>
        </Pressable>

        <PrimaryButton
          label={enCours ? "Enregistrement…" : "J'accepte et je continue"}
          onPress={valider}
          disabled={!coche || enCours}
          loading={enCours}
        />

        <Pressable onPress={() => logout()} style={styles.deconnexion}>
          <Text style={styles.deconnexionText}>Me déconnecter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    padding: spacing.xl, paddingTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerText: { flex: 1 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  badge: { fontSize: 10, fontWeight: "700", color: colors.primary, letterSpacing: 0.6 },
  titre: { fontSize: 15, fontWeight: "800", color: colors.text, lineHeight: 20 },
  sousTitre: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },

  clause: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  clauseNumero: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
  },
  clauseNumeroText: { fontSize: 10, fontWeight: "700", color: colors.primary },
  clauseTexte: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },

  noteBox: {
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.sm,
  },
  noteTexte: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17 },

  footer: {
    padding: spacing.xl, gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 18 },

  deconnexion: { alignItems: "center", paddingVertical: spacing.xs },
  deconnexionText: { fontSize: 12.5, color: colors.textMuted },
});

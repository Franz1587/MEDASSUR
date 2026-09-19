import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";
import { PrimaryButton } from "../../components/ui";
import { changerMonMotDePasse } from "../../api/profil";
import { messageErreur } from "../../api/http";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";

// Changement de mot de passe imposé (2026-09) — voir demande utilisateur :
// "la saisie du mot de passe pour la première fois ne demande pas de
// réinitialiser le mot de passe à la première connexion... pour une
// meilleure sécurité". Miroir de
// src/auth/ChangementMotDePasseObligatoire.tsx côté web — rendu par
// RootNavigator À LA PLACE de MainTabs tant que
// currentUser.doitChangerMotDePasse est vrai, avant le moindre accès à
// l'application.
export function ChangementMotDePasseObligatoireScreen() {
  const { refreshCurrentUser, logout } = useAuth();
  const [ancienMdp, setAncienMdp] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [voirMdp, setVoirMdp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const keyboardHeight = useKeyboardHeight();

  const soumettre = async () => {
    if (nouveauMdp.length < 8) {
      Alert.alert("Mot de passe trop court", "Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (nouveauMdp !== confirmationMdp) {
      Alert.alert("Mots de passe différents", "Les deux mots de passe ne correspondent pas.");
      return;
    }
    try {
      setSubmitting(true);
      await changerMonMotDePasse(ancienMdp, nouveauMdp);
      await refreshCurrentUser();
    } catch (err) {
      Alert.alert("Erreur", messageErreur(err, "Impossible de changer le mot de passe."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: Math.max(spacing.xl, keyboardHeight) }]}
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
      </View>
      <Text style={styles.titre}>Nouveau mot de passe requis</Text>
      <Text style={styles.sousTitre}>
        Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer — celui que vous avez reçu était temporaire.
      </Text>

      <View style={styles.champ}>
        <Text style={styles.label}>Mot de passe actuel (reçu par SMS/WhatsApp)</Text>
        <TextInput value={ancienMdp} onChangeText={setAncienMdp} style={styles.input} secureTextEntry={!voirMdp} placeholderTextColor={colors.textSubtle} autoFocus />
      </View>
      <View style={styles.champ}>
        <Text style={styles.label}>Nouveau mot de passe</Text>
        <TextInput value={nouveauMdp} onChangeText={setNouveauMdp} style={styles.input} secureTextEntry={!voirMdp} placeholderTextColor={colors.textSubtle} />
      </View>
      <View style={styles.champ}>
        <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
        <TextInput value={confirmationMdp} onChangeText={setConfirmationMdp} style={styles.input} secureTextEntry={!voirMdp} placeholderTextColor={colors.textSubtle} />
      </View>

      <Pressable style={styles.toggleVoir} onPress={() => setVoirMdp((v) => !v)}>
        <Ionicons name={voirMdp ? "eye-off-outline" : "eye-outline"} size={16} color={colors.textMuted} />
        <Text style={styles.toggleVoirText}>{voirMdp ? "Masquer" : "Afficher"} les mots de passe</Text>
      </Pressable>

      <PrimaryButton label="Valider" onPress={soumettre} loading={submitting} disabled={submitting} />

      <Pressable onPress={() => logout()} style={styles.deconnexion}>
        <Text style={styles.deconnexionText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: "center" },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.lg,
  },
  titre: { fontSize: 19, fontWeight: "800", color: colors.text, textAlign: "center" },
  sousTitre: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 18 },
  champ: { marginBottom: spacing.md },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  input: {
    height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 14, color: colors.text,
  },
  toggleVoir: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginBottom: spacing.lg },
  toggleVoirText: { fontSize: 12.5, color: colors.textMuted },
  deconnexion: { marginTop: spacing.lg, alignItems: "center" },
  deconnexionText: { fontSize: 12.5, color: colors.textMuted },
});

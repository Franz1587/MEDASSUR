import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, Image,
  ScrollView, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { colors, radius, spacing } from "../../theme/colors";
import { PrimaryButton } from "../../components/ui";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";

const logoFull = require("../../../assets/brand/logo-full.png");

// Écran de connexion réel — MÊME contrat que src/auth/LoginView.tsx +
// LoginForm.tsx côté web (POST /auth/login { email, password }), même
// dégradé de marque. Aucun compte codé en dur : le formulaire appelle
// toujours /auth/login ; paul.ondo@assure.medassur.local n'est qu'un
// compte de test réel utilisé pour vérifier l'appli, jamais pré-rempli
// silencieusement en production.
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Champ masqué par le clavier (2026-09) — voir demande utilisateur : "on
  // ne peut plus voir ce qu'on saisit dans la zone barrée ou masquée par le
  // clavier". Le comportement Android par défaut (adjustResize) ne suffit
  // plus de façon fiable sur les appareils récents (edge-to-edge) —
  // paddingBottom = hauteur réelle du clavier force le contenu à défiler
  // au-dessus, sur les deux plateformes.
  const keyboardHeight = useKeyboardHeight();

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Renseignez votre email et votre mot de passe.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={colors.gradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={[styles.scroll, keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing.xl, justifyContent: "flex-start" }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandCard}>
            <Image source={logoFull} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.tagline}>Votre espace assuré MEDASSUR</Text>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Connexion</Text>
            <Text style={styles.formSubtitle}>Accédez à votre carte, vos garanties et vos remboursements.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSubtle}
                  secureTextEntry={!showPassword}
                  style={[styles.input, { flex: 1, borderWidth: 0 }]}
                  editable={!loading}
                  onSubmitEditing={onSubmit}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} style={{ paddingHorizontal: 10 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <PrimaryButton label={loading ? "Connexion…" : "Se connecter"} onPress={onSubmit} loading={loading} icon="log-in-outline" />
          </View>

          <Text style={styles.footer}>© 2026 MEDASSUR — Gabon</Text>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  brandCard: {
    backgroundColor: "#fff", borderRadius: radius.xl, paddingHorizontal: 22, paddingVertical: 16,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  logo: { width: 190, height: 64 },
  tagline: { color: "#ffffffdd", fontSize: 14, fontWeight: "600", marginTop: spacing.lg, marginBottom: spacing.xl, textAlign: "center" },
  formCard: {
    width: "100%", maxWidth: 400, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: radius.xl,
    padding: spacing.xl, gap: spacing.xs,
  },
  formTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  formSubtitle: { fontSize: 12.5, color: colors.textMuted, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  passwordRow: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, backgroundColor: colors.surface,
  },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10, marginBottom: spacing.md },
  errorText: { color: colors.danger, fontSize: 12.5, flex: 1 },
  footer: { color: "#ffffffaa", fontSize: 11.5, marginTop: spacing.xl },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, TextInput } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen, ScreenHeader, Badge, PrimaryButton, EmptyState, LoadingView, ErrorView, FormField, inputStyle,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { messageErreur } from "../../api/http";
import { getConversations, creerConversation, type Conversation } from "../../api/messagerie";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import type { RootStackParamList } from "../../navigation/types";

// Messagerie — liste des conversations avec MedAssur. Confidentialité de
// l'identité de l'agent (voir src/features/messagerie/Messagerie.tsx côté
// web) : côté externe (assuré), on ne révèle JAMAIS le canal IA/Humain ni le
// statut interne — toute nouvelle conversation démarre silencieusement sur
// canal "IA" (bascule vers un conseiller gérée côté serveur, invisible ici),
// et les statuts affichés restent neutres.
const STATUT_VARIANT: Record<string, "success" | "warning" | "info" | "neutral"> = {
  Ouverte: "warning", EnCoursIA: "info", EnCoursHumain: "info", Resolue: "success", Fermee: "neutral",
};
const STATUT_LABEL: Record<string, string> = {
  Ouverte: "Ouverte", EnCoursIA: "En cours", EnCoursHumain: "En cours", Resolue: "Résolue", Fermee: "Fermée",
};

const POLL_MS = 20_000;

function NouvelleConversationModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [objet, setObjet] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Clavier qui recouvre le formulaire (2026-09) — voir demande utilisateur :
  // "on ne peut plus voir ce qu'on saisit dans cette zone car le clavier
  // masque la zone de saisie". Décalage explicite de la carte (ancrée en
  // bas de l'écran) au-dessus du clavier, fiable sur toutes les versions
  // d'Android contrairement à KeyboardAvoidingView seul.
  const keyboardHeight = useKeyboardHeight();

  const envoyer = async () => {
    if (!objet.trim() || !message.trim()) { setErreur("Objet et message sont obligatoires."); return; }
    setErreur(null);
    setEnvoi(true);
    try {
      const conversation = await creerConversation(objet.trim(), "IA", message.trim());
      setObjet(""); setMessage("");
      onCreated(conversation);
    } catch (err) {
      setErreur(messageErreur(err, "Envoi impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { marginBottom: keyboardHeight }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle conversation</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
          </View>

          <FormField label="Objet">
            <TextInput value={objet} onChangeText={setObjet} style={inputStyle.base} placeholder="Ex. Question sur ma prise en charge" placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label="Message">
            <TextInput
              value={message} onChangeText={setMessage} multiline numberOfLines={4}
              style={[inputStyle.base, { height: 90, textAlignVertical: "top" }]}
              placeholder="Décrivez votre demande…" placeholderTextColor={colors.textSubtle}
            />
          </FormField>
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <PrimaryButton label="Envoyer" onPress={envoyer} loading={envoi} icon="send-outline" />
        </View>
      </View>
    </Modal>
  );
}

export function MessagerieListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOuvert, setModalOuvert] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true);
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      if (!silencieux) setError(messageErreur(err, "Impossible de charger vos conversations."));
    } finally {
      if (!silencieux) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]));

  if (loading && !conversations) {
    return (
      <Screen>
        <ScreenHeader title="Messagerie" />
        <LoadingView label="Chargement de vos conversations…" />
      </Screen>
    );
  }

  if (error && !conversations) {
    return (
      <Screen>
        <ScreenHeader title="Messagerie" />
        <ErrorView message={error} onRetry={() => load()} />
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => load()} refreshing={loading}>
      <ScreenHeader title="Messagerie" subtitle="Échangez directement avec MedAssur" />

      <PrimaryButton label="Nouvelle conversation" icon="add" onPress={() => setModalOuvert(true)} />

      <View style={{ height: spacing.lg }} />

      {!conversations || conversations.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="Aucune conversation" subtitle="Démarrez une conversation avec MedAssur." />
      ) : (
        [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => (
          <Pressable
            key={c.id}
            onPress={() => navigation.navigate("MessagerieConversation", { id: c.id, objet: c.objet })}
            style={({ pressed }) => [styles.card, pressed ? { opacity: 0.7 } : null]}
          >
            <View style={styles.icon}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.objet} numberOfLines={1}>{c.objet}</Text>
              <Text style={styles.date}>{new Date(c.updatedAt).toLocaleString("fr-FR")}</Text>
            </View>
            <Badge label={STATUT_LABEL[c.statut] ?? c.statut} variant={STATUT_VARIANT[c.statut] ?? "neutral"} />
          </Pressable>
        ))
      )}

      <NouvelleConversationModal
        visible={modalOuvert}
        onClose={() => setModalOuvert(false)}
        onCreated={(c) => {
          setModalOuvert(false);
          load();
          navigation.navigate("MessagerieConversation", { id: c.id, objet: c.objet });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary + "1a", alignItems: "center", justifyContent: "center" },
  objet: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  date: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  erreur: { fontSize: 12.5, color: colors.danger, marginBottom: spacing.md },
});

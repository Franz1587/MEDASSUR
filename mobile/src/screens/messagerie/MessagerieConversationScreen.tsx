import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Alert, ActivityIndicator, Linking,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { LoadingView, ErrorView } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import { messageErreur, QueuedOfflineError, type RnFilePart } from "../../api/http";
import {
  getMessages, envoyerMessage, marquerConversationLue, urlPieceJointeMessagerie, type Message,
} from "../../api/messagerie";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import type { RootStackParamList } from "../../navigation/types";

// Fil de discussion — MÊME comportement que
// src/features/messagerie/Messagerie.tsx côté web, adapté au chat natif
// (bulles gauche/droite, composeur fixe en bas). Confidentialité de
// l'identité de l'agent (voir mémoire projet / mission) : côté externe
// (assuré), tout message qui n'est pas de l'utilisateur s'affiche comme
// venant d'"Ariana" — jamais de mention explicite IA/Agent.
const POLL_MS = 20_000;

export function MessagerieConversationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MessagerieConversation">>();
  const { id, objet } = route.params;
  const { currentUser } = useAuth();

  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<RnFilePart | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Barre système Android (2026-09) — voir demande utilisateur : "on ne peut
  // pas écrire les messages à cause de ce menu du téléphone. Il doit se
  // masquer" — le composeur restait sous la barre de navigation système
  // (boutons ☰/○/↩ ou geste), avec un simple padding fixe ne tenant pas
  // compte de sa hauteur réelle (variable selon l'appareil/le mode
  // gestes-vs-boutons). insets.bottom la donne de façon fiable.
  const insets = useSafeAreaInsets();
  // Clavier qui recouvre le composeur (2026-09) — voir demande utilisateur :
  // "on ne voit pas le message qu'on est en train de rédiger... cette zone
  // devrait remonter et se placer au-dessus du clavier". KeyboardAvoidingView
  // seul (behavior="height") ne suffisait pas de façon fiable sur tous les
  // appareils — remplacé par un décalage explicite basé sur la hauteur
  // réelle du clavier (voir useKeyboardHeight), déterministe sur toutes les
  // plateformes/versions Android.
  const keyboardHeight = useKeyboardHeight();

  useLayoutEffect(() => { navigation.setOptions({ title: objet }); }, [navigation, objet]);

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true);
    setError(null);
    try {
      const data = await getMessages(id);
      setMessages(data);
    } catch (err) {
      if (!silencieux) setError(messageErreur(err, "Impossible de charger la conversation."));
    } finally {
      if (!silencieux) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    charger();
    marquerConversationLue(id).catch(() => undefined);
    pollRef.current = setInterval(() => charger(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id, charger]);

  const choisirPieceJointe = () => {
    Alert.alert("Pièce jointe", "Que souhaitez-vous joindre ?", [
      { text: "Photo", onPress: choisirPhoto },
      { text: "Document", onPress: choisirDocument },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const choisirPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Autorisation requise", "Autorisez l'accès à vos photos pour joindre une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPiece({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? "image/jpeg" });
  };

  const choisirDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPiece({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/octet-stream" });
  };

  const envoyer = async () => {
    if (!texte.trim() && !piece) return;
    setEnvoi(true);
    try {
      await envoyerMessage(id, texte.trim(), piece ?? undefined);
      setTexte("");
      setPiece(null);
      await charger(true);
      listRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      if (err instanceof QueuedOfflineError) {
        // Pas une erreur : le message est en file, il partira seul à la
        // reconnexion (voir syncManager.ts) — on vide quand même le
        // composeur pour ne pas donner l'impression que l'envoi a échoué.
        setTexte("");
        setPiece(null);
        Alert.alert("Pas de connexion", "Votre message a été enregistré et sera envoyé dès le retour du réseau.");
      } else {
        Alert.alert("Envoi impossible", messageErreur(err));
      }
    } finally {
      setEnvoi(false);
    }
  };

  if (loading && !messages) {
    return <LoadingView label="Chargement de la conversation…" />;
  }

  if (error && !messages) {
    return <ErrorView message={error} onRetry={() => charger()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={listRef}
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const moi = item.auteurId === currentUser?.id;
          return (
            <View style={[styles.bulleRow, moi ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
              <View style={[styles.bulle, moi ? styles.bulleMoi : styles.bulleAutre]}>
                {!moi ? <Text style={styles.auteur}>Ariana</Text> : null}
                {item.contenu ? <Text style={[styles.texteMsg, moi ? { color: "#fff" } : { color: colors.text }]}>{item.contenu}</Text> : null}
                {item.pieceJointe ? (
                  <Pressable onPress={() => Linking.openURL(urlPieceJointeMessagerie(item.pieceJointe!))}>
                    <Text style={[styles.piece, moi ? { color: "#ffffffcc" } : { color: colors.primary }]}>
                      <Ionicons name="attach" size={12} /> Pièce jointe
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.heure, moi ? { color: "#ffffffaa" } : { color: colors.textSubtle }]}>
                  {new Date(item.dateEnvoi).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.composerWrap, { paddingBottom: Math.max(spacing.sm, insets.bottom), marginBottom: keyboardHeight }]}>
        {piece ? (
          <View style={styles.pieceRow}>
            <Ionicons name="attach" size={14} color={colors.textMuted} />
            <Text style={styles.pieceNom} numberOfLines={1}>{piece.name}</Text>
            <Pressable onPress={() => setPiece(null)}><Ionicons name="close-circle" size={16} color={colors.danger} /></Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <Pressable onPress={choisirPieceJointe} style={styles.attachBtn}>
            <Ionicons name="attach" size={20} color={colors.textMuted} />
          </Pressable>
          <TextInput
            value={texte}
            onChangeText={setTexte}
            placeholder="Votre message…"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
            multiline
          />
          <Pressable onPress={envoyer} disabled={envoi || (!texte.trim() && !piece)} style={[styles.sendBtn, (envoi || (!texte.trim() && !piece)) && { opacity: 0.5 }]}>
            {envoi ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bulleRow: { flexDirection: "row" },
  bulle: { maxWidth: "78%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bulleMoi: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bulleAutre: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
  auteur: { fontSize: 10.5, fontWeight: "700", color: colors.primary, marginBottom: 2 },
  texteMsg: { fontSize: 13.5, lineHeight: 18 },
  piece: { fontSize: 11.5, marginTop: 4, fontWeight: "600" },
  heure: { fontSize: 10, marginTop: 4 },
  composerWrap: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.sm },
  pieceRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingBottom: 6 },
  pieceNom: { flex: 1, fontSize: 11.5, color: colors.textMuted },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  attachBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5, color: colors.text,
    maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});

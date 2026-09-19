import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import Pdf from "react-native-pdf";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../../theme/colors";
import { API_URL, getAccessToken, messageErreur } from "../../api/http";
import { ouvrirDocument } from "../../api/documents";
import type { RootStackParamList } from "../../navigation/types";

// Visionneuse PDF intégrée (2026-09) — voir demande utilisateur : "il faut
// normalement que lorsqu'on clique ici le document s'ouvre dans
// l'application et non hors de l'application" + "les document PDF s'ouvre
// dans l'application comme dans la version web au lieu se télécharger
// systématiquement". Avant ce correctif, TOUT document (feuille de soins,
// feuille d'examen, certificat de prise en charge…) passait par
// ouvrirDocument() → téléchargement + feuille de partage native, même pour
// une simple consultation. Ici : rendu natif via react-native-pdf (même
// approche que CarteScreen.tsx), le téléchargement/partage devient une
// action explicite secondaire (bouton dédié), plus le comportement par
// défaut d'un clic sur "voir".
export function DocumentViewerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "DocumentViewer">>();
  const { path, titre } = route.params;
  const insets = useSafeAreaInsets();
  // `path` est soit un chemin API relatif (route protégée, générée à la
  // volée — feuille de soins, certificat…), soit une URL absolue vers un
  // fichier déjà uploadé (ex. urlCarnetSante(), servi publiquement sous
  // /uploads/ côté backend, sans exiger le header d'autorisation).
  const uri = /^https?:\/\//i.test(path) ? path : `${API_URL}${path}`;

  const [token, setToken] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { getAccessToken().then(setToken); }, []);

  const telecharger = async () => {
    setDownloading(true);
    try {
      await ouvrirDocument(path, `${titre}.pdf`);
    } catch (err) {
      Alert.alert("Impossible d'ouvrir le document", messageErreur(err, "Réessayez dans un instant."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.titre} numberOfLines={1}>{titre}</Text>
        <Pressable onPress={telecharger} disabled={downloading} hitSlop={10} style={styles.shareBtn}>
          <Ionicons name={downloading ? "hourglass-outline" : "share-outline"} size={20} color={colors.primary} />
        </Pressable>
      </View>

      {token === null ? null : pdfError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.textSubtle} />
          <Text style={styles.erreurTexte}>Impossible d'afficher ce document ici.</Text>
          <Pressable onPress={telecharger} style={styles.retryBtn}>
            <Text style={styles.retryTexte}>Télécharger / Partager</Text>
          </Pressable>
        </View>
      ) : (
        <Pdf
          source={{
            uri,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            cache: true,
          }}
          trustAllCerts={false}
          onError={() => setPdfError(true)}
          style={{ flex: 1, backgroundColor: colors.surfaceMuted }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  titre: { flex: 1, fontSize: 14.5, fontWeight: "700", color: colors.text },
  shareBtn: { padding: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  erreurTexte: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  retryTexte: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Dimensions } from "react-native";
import Pdf from "react-native-pdf";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import {
  Screen, ScreenHeader, Badge, PrimaryButton, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import {
  getMoi, getMaFamille, cheminCarteDe,
  type MembreIdentite, type MembreFamilleMembre,
} from "../../api/portailMembre";
import { ouvrirDocument } from "../../api/documents";
import { API_URL, getAccessToken, messageErreur } from "../../api/http";
import type { RootStackParamList } from "../../navigation/types";

// Ma carte (2026-09) — voir demande utilisateur : "l'application mobile
// doit afficher exactement le même modèle recto de chaque carte, exactement
// le modèle de carte en vigueur pour le courtier, la compagnie d'assurance
// ou la mutuelle qui utilise MedAssur". La reconstitution "carte bancaire"
// précédente (dégradé + texte) ne reflète NI le vrai visuel de marque du
// tiers (logo, mise en page propre à chacun — voir
// DocumentsService.renderCarteUnique côté backend, généré en PDFKit avec le
// gabarit réel), ni les cas où plusieurs tiers utilisent des gabarits
// différents. On affiche donc directement le PDF officiel (recto puis
// verso, mêmes pages que le document imprimé) via react-native-pdf — un
// rendu NATIF (pas de plugin navigateur requis, donc fiable sur tous les
// appareils), à la différence de l'ancienne tentative web en iframe qui
// restait blanche sur mobile (voir PdfViewerHost.tsx, corrigé séparément
// côté web par un rendu pdf.js/canvas).
const CARD_ASPECT = 1.586; // format carte CR80 (85.6mm x 53.98mm), même gabarit que le backend (CARD_WIDTH/CARD_HEIGHT)
const CARD_WIDTH = Math.min(Dimensions.get("window").width - spacing.lg * 2, 420);
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT;

// statutVariant() (kit UI partagé) reconnaît "actif" mais pas "active" (le
// statut réel renvoyé pour StatutCarte) — mapping dédié local, même logique
// que src/features/portail-membre/Carte.tsx côté web (Active → success).
function statutCarteVariant(statut: string): "success" | "warning" | "danger" | "neutral" {
  if (statut === "Active") return "success";
  if (statut === "Suspendue") return "warning";
  if (statut === "Inactive") return "danger";
  return "neutral";
}

interface CardPersonne {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  numeroAssure: string | null;
  statutCarte: string | null;
  qrCode?: string | null;
  compagnie?: string | null;
}

export function CarteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "CarteMembre">>();
  const { currentUser } = useAuth();
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [famille, setFamille] = useState<MembreFamilleMembre[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(route.params?.assureId ?? currentUser?.assureSanteId ?? "");
  const [downloading, setDownloading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(2);
  const [pdfError, setPdfError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, f, t] = await Promise.all([getMoi(), getMaFamille(), getAccessToken()]);
      setMoi(m);
      setFamille(f);
      setToken(t);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger votre carte."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Revenir au recto (page 1) à chaque changement de personne sélectionnée.
  useEffect(() => { setPage(1); setPdfError(false); }, [selectedId]);

  const personnes: CardPersonne[] = useMemo(() => {
    const liste: CardPersonne[] = [];
    if (moi) {
      liste.push({
        id: moi.id,
        nom: moi.nom,
        prenom: moi.prenom,
        matricule: moi.matricule,
        typeAssure: moi.typeAssure ?? "AS",
        numeroAssure: moi.numeroAssure,
        statutCarte: moi.statutCarte,
        compagnie: moi.contrat?.compagnie?.nom ?? null,
      });
    }
    for (const f of famille ?? []) {
      liste.push({
        id: f.id,
        nom: f.nom,
        prenom: f.prenom,
        matricule: f.matricule,
        typeAssure: f.typeAssure,
        numeroAssure: f.numeroAssure ?? null,
        statutCarte: f.statutCarte,
        qrCode: f.qrCode,
      });
    }
    return liste;
  }, [moi, famille]);

  const selected = personnes.find((p) => p.id === selectedId) ?? personnes[0] ?? null;

  const telecharger = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      await ouvrirDocument(cheminCarteDe(selected.id), `carte-${selected.matricule}.pdf`);
    } catch (err) {
      Alert.alert("Impossible d'ouvrir la carte", messageErreur(err, "Réessayez dans un instant."));
    } finally {
      setDownloading(false);
    }
  };

  if (loading && personnes.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Ma carte" />
        <LoadingView label="Chargement de votre carte…" />
      </Screen>
    );
  }

  if (error && personnes.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Ma carte" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Ma carte" subtitle="Vous et vos ayants droit" />

      {personnes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }} contentContainerStyle={{ gap: spacing.sm }}>
          {personnes.map((p) => {
            const active = p.id === selected?.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelectedId(p.id)}
                style={[styles.pill, active ? styles.pillActive : null]}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : null]} numberOfLines={1}>
                  {p.nom} {p.prenom ? p.prenom.charAt(0) + "." : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {selected ? (
        <>
          {selected.statutCarte ? (
            <View style={styles.statutRow}>
              <Badge label={selected.statutCarte} variant={statutCarteVariant(selected.statutCarte)} />
            </View>
          ) : null}

          <View style={[styles.cardFrame, pdfError && styles.cardError]}>
            {pdfError ? (
              <>
                <Ionicons name="alert-circle-outline" size={22} color={colors.textSubtle} />
                <Text style={styles.cardErrorText}>Aperçu indisponible pour l'instant.</Text>
              </>
            ) : (
              <Pdf
                key={selected.id}
                source={{
                  uri: `${API_URL}${cheminCarteDe(selected.id)}`,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  cache: true,
                }}
                page={page}
                singlePage
                trustAllCerts={false}
                onLoadComplete={(numberOfPages) => setPageCount(numberOfPages)}
                onError={() => setPdfError(true)}
                style={styles.pdf}
              />
            )}
          </View>

          {pageCount > 1 ? (
            <View style={styles.pageSwitch}>
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]}
              >
                <Ionicons name="chevron-back" size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.pageLabel}>{page === 1 ? "Recto" : "Verso"} — {page}/{pageCount}</Text>
              <Pressable
                onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                style={[styles.pageBtn, page >= pageCount && { opacity: 0.4 }]}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton
              label={downloading ? "Ouverture…" : "Télécharger / Partager le PDF"}
              icon="share-outline"
              loading={downloading}
              onPress={telecharger}
            />
          </View>
        </>
      ) : (
        <ErrorView message="Aucune carte disponible pour votre compte." onRetry={load} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  pillTextActive: { color: "#fff" },
  statutRow: { alignItems: "flex-end", marginBottom: spacing.sm },
  cardFrame: {
    width: CARD_WIDTH, height: CARD_HEIGHT, alignSelf: "center",
    borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceMuted,
    borderWidth: 1, borderColor: colors.border,
  },
  pdf: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: colors.surfaceMuted },
  cardError: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  cardErrorText: { fontSize: 12.5, color: colors.textSubtle },
  pageSwitch: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md,
    marginTop: spacing.md,
  },
  pageBtn: {
    width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  pageLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
});

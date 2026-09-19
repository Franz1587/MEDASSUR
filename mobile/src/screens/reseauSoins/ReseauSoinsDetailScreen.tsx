import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Linking, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LeafletMap } from "../../components/LeafletMap";
import {
  Screen, ScreenHeader, Card, SectionTitle, ListRow, Badge, statutVariant, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { getPrestataireReseau, type PrestataireReseauDetail } from "../../api/reseauSoins";
import { messageErreur } from "../../api/http";
import { obtenirPositionActuelle, type Position } from "../../utils/position";
import { distanceKm, formaterDistance } from "../../utils/distance";
import { ouvrirItineraire } from "../../utils/itineraire";
import type { RootStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rte = RouteProp<RootStackParamList, "ReseauSoinsDetail">;

// Fiche prestataire — MÊME logique que src/features/portail-membre/ReseauSoins.tsx
// (bloc détail web) : contact/adresse/secteur + médecins qui y exercent.
export function ReseauSoinsDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rte>();
  const [detail, setDetail] = useState<PrestataireReseauDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPrestataireReseau(params.id);
      setDetail(data);
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger ce prestataire."));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { obtenirPositionActuelle().then(setPosition); }, []);

  if (loading && !detail) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Prestataire" />
        <LoadingView label="Chargement du prestataire…" />
      </Screen>
    );
  }

  if (error && !detail) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Prestataire" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!detail) return null;

  const aDesCoordonnees = detail.latitude != null && detail.longitude != null;
  const distance = aDesCoordonnees && position
    ? distanceKm(position, { latitude: detail.latitude as number, longitude: detail.longitude as number })
    : null;

  return (
    <Screen>
      <ScreenHeader title={`${detail.titre ? `${detail.titre} ` : ""}${detail.nom}`} subtitle={`${detail.type}${detail.specialite ? ` · ${detail.specialite}` : ""}`} />

      <Card>
        <View style={styles.rowBetween}>
          <Badge label={detail.statutConvention} variant={statutVariant(detail.statutConvention)} />
          {detail.secteur ? <Badge label={detail.secteur} variant={detail.secteur === "Public" ? "info" : "neutral"} /> : null}
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={colors.textMuted} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            {detail.adresse ? `${detail.adresse}, ` : ""}{detail.ville}, {detail.pays}
            {distance != null ? <Text style={styles.distanceInline}>  ·  {formaterDistance(distance)} de vous</Text> : null}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.infoIcon} />
          {detail.telephone ? (
            <Text style={[styles.infoText, styles.link]} onPress={() => Linking.openURL(`tel:${detail.telephone!.split(" · ")[0].replace(/\s+/g, "")}`)}>
              {detail.telephone}
            </Text>
          ) : (
            <Text style={styles.infoTextMuted}>Téléphone non renseigné</Text>
          )}
        </View>
      </Card>

      {aDesCoordonnees ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {/* Carte interactive + zoom fixe et précis (2026-09) — voir demande
              utilisateur : "on ne peut pas voir avec exactitude où est le
              prestataire". Interactive (pincer/déplacer) pour vérifier
              l'emplacement exact, zoom=17 (niveau rue) au lieu du zoom
              "ville" utilisé sur la carte de liste. */}
          <LeafletMap
            style={styles.map}
            interactive
            zoom={17}
            position={position}
            points={[{
              id: detail.id,
              latitude: detail.latitude as number,
              longitude: detail.longitude as number,
              titre: detail.nom,
              description: detail.adresse ?? undefined,
            }]}
          />
          <Pressable
            style={styles.itineraireBtn}
            onPress={() => ouvrirItineraire(detail.latitude as number, detail.longitude as number, detail.nom)}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.itineraireBtnText}>Itinéraire</Text>
          </Pressable>
        </Card>
      ) : null}

      {detail.medecins.length > 0 ? (
        <>
          <SectionTitle>Médecins ({detail.medecins.length})</SectionTitle>
          <Card style={{ padding: 0 }}>
            <View style={{ paddingHorizontal: spacing.lg }}>
              {detail.medecins.map((m) => (
                <ListRow
                  key={m.id}
                  icon="person-circle-outline"
                  label={`${m.titre ? `${m.titre} ` : ""}${m.nom}`}
                  sublabel={m.specialite ?? undefined}
                  onPress={() => navigation.push("ReseauSoinsDetail", { id: m.id })}
                />
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: spacing.sm },
  infoIcon: { marginTop: 1 },
  infoText: { flex: 1, fontSize: 14, color: colors.text },
  infoTextMuted: { flex: 1, fontSize: 14, color: colors.textSubtle, fontStyle: "italic" },
  distanceInline: { color: colors.primary, fontWeight: "700" },
  link: { color: colors.primary, fontWeight: "600" },
  map: { height: 240, width: "100%" },
  itineraireBtn: {
    position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, height: 38, borderRadius: radius.pill,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  itineraireBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

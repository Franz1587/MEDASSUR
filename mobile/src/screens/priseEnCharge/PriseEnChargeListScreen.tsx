import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../navigation/types";
import {
  Screen, ScreenHeader, Card, ListRow, Badge, statutVariant, PrimaryButton,
  EmptyState, LoadingView, ErrorView, formatDate,
} from "../../components/ui";
import { getMesPrisesEnChargePrealables, type MembreAccordPrealable } from "../../api/portailMembre";
import { messageErreur } from "../../api/http";
import { marquerPlusieursVus } from "../../utils/vus";

// Onglet "Prise en charge" — historique des demandes d'entente préalable de
// l'assuré (GET /portail-membre/accords-prealables), plus bouton d'en-tête
// vers la nouvelle demande (écran racine "AccordNouveau"). Référence web :
// src/features/portail-membre/PriseEnCharge.tsx.
type Nav = CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList, "PriseEnCharge">, NativeStackNavigationProp<RootStackParamList>>;

// dateDemande est une chaîne "JJ/MM/AAAA" (voir AccordPrealable.dateDemande,
// champ String libre côté backend) — on la parse juste pour trier, jamais
// pour l'affichage (formatDate() passe déjà les dates françaises telles quelles).
function parseFrDateMs(v: string | null | undefined): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? "");
  if (!m) return 0;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

export function PriseEnChargeListScreen() {
  const navigation = useNavigation<Nav>();
  const [dossiers, setDossiers] = useState<MembreAccordPrealable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const charger = useCallback(async () => {
    setError(null);
    try {
      const data = await getMesPrisesEnChargePrealables();
      setDossiers(data);
      // Bulle de compteur (2026-09) — voir demande utilisateur : "si on a
      // déjà ouvert la rubrique et consulté, ça doit disparaître". Ouvrir
      // CETTE liste (la rubrique elle-même), pas seulement le détail d'une
      // ligne précise, suffit à marquer tous les dossiers "en attente"
      // actuellement visibles comme vus (voir MainTabs.tsx/DashboardScreen.tsx,
      // qui recalculent la bulle à partir de ce même marqueur).
      const idsEnAttente = data.filter((d) => d.decision === "En attente").map((d) => d.id);
      marquerPlusieursVus("priseEnCharge", idsEnAttente).catch(() => undefined);
    } catch (err) {
      setError(messageErreur(err, "Chargement impossible."));
    }
  }, []);

  // Rechargement à chaque retour sur l'onglet (ex. après une nouvelle
  // demande envoyée depuis AccordNouveauScreen, poussé par-dessus ce tab).
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await charger();
    setRefreshing(false);
  };

  const tries = useMemo(
    () => (dossiers ? [...dossiers].sort((a, b) => parseFrDateMs(b.dateDemande) - parseFrDateMs(a.dateDemande)) : []),
    [dossiers],
  );

  return (
    <Screen onRefresh={dossiers !== null ? onRefresh : undefined} refreshing={refreshing}>
      <ScreenHeader
        title="Prise en charge"
        subtitle="Vos demandes d'entente préalable"
        right={<PrimaryButton label="Nouvelle" icon="add" onPress={() => navigation.navigate("AccordNouveau")} />}
      />
      {dossiers === null && !error ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={charger} />
      ) : tries.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="Aucune demande"
          subtitle="Vos demandes de prise en charge apparaîtront ici."
        />
      ) : (
        <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
          {tries.map((d) => (
            <ListRow
              key={d.id}
              icon="medkit-outline"
              label={d.type}
              sublabel={`${d.prestataire} · ${formatDate(d.dateDemande)}`}
              onPress={() => navigation.navigate("AccordDetail", { id: d.id })}
              right={<Badge label={d.decision} variant={statutVariant(d.decision)} />}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

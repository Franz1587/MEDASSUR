import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabParamList, RootStackParamList } from "../../navigation/types";
import {
  Screen, ScreenHeader, Card, ListRow, Badge, statutVariant, PrimaryButton,
  EmptyState, LoadingView, ErrorView, formatDate, formatMontant,
} from "../../components/ui";
import { getMesPrisesEnCharge, type MembrePriseEnCharge } from "../../api/portailMembre";
import { messageErreur } from "../../api/http";

// Onglet "Remboursement" — historique des demandes de remboursement de
// l'assuré (GET /portail-membre/prises-en-charge?modePaiement=Remboursement),
// plus bouton d'en-tête vers la nouvelle demande. Référence web :
// src/features/portail-membre/Remboursement.tsx.
type Nav = CompositeNavigationProp<BottomTabNavigationProp<MainTabParamList, "Remboursement">, NativeStackNavigationProp<RootStackParamList>>;

// `date` est une chaîne "JJ/MM/AAAA" (PriseEnCharge.date, String libre côté
// backend) — parsée uniquement pour le tri, jamais pour l'affichage.
function parseFrDateMs(v: string | null | undefined): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? "");
  if (!m) return 0;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

export function RemboursementListScreen() {
  const navigation = useNavigation<Nav>();
  const [lignes, setLignes] = useState<MembrePriseEnCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const charger = useCallback(async () => {
    setError(null);
    try {
      const data = await getMesPrisesEnCharge("Remboursement");
      setLignes(data);
    } catch (err) {
      setError(messageErreur(err, "Chargement impossible."));
    }
  }, []);

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

  const triees = useMemo(
    () => (lignes ? [...lignes].sort((a, b) => parseFrDateMs(b.date) - parseFrDateMs(a.date)) : []),
    [lignes],
  );

  return (
    <Screen onRefresh={lignes !== null ? onRefresh : undefined} refreshing={refreshing}>
      <ScreenHeader
        title="Remboursement"
        subtitle="Vos demandes de remboursement"
        right={<PrimaryButton label="Nouvelle" icon="add" onPress={() => navigation.navigate("RemboursementNouveau")} />}
      />
      {lignes === null && !error ? (
        <LoadingView />
      ) : error ? (
        <ErrorView message={error} onRetry={charger} />
      ) : triees.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Aucune demande"
          subtitle="Vos demandes de remboursement apparaîtront ici."
        />
      ) : (
        <Card style={{ paddingVertical: 4, paddingHorizontal: 16 }}>
          {triees.map((l) => (
            <ListRow
              key={l.id}
              icon="receipt-outline"
              label={l.type || "Remboursement"}
              sublabel={`${l.prestataire} · ${formatDate(l.date)} · ${formatMontant(l.montant)}`}
              onPress={() => navigation.navigate("RemboursementDetail", { id: l.id })}
              right={<Badge label={l.statut} variant={statutVariant(l.statut)} />}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

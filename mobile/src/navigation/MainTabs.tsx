import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { MainTabParamList } from "./types";
import { colors } from "../theme/colors";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import { PriseEnChargeListScreen } from "../screens/priseEnCharge/PriseEnChargeListScreen";
import { RemboursementListScreen } from "../screens/remboursement/RemboursementListScreen";
import { CarnetSanteScreen } from "../screens/carnet/CarnetSanteScreen";
import { PlusMenuScreen } from "../screens/plus/PlusMenuScreen";
import { getMesPrisesEnChargePrealables } from "../api/portailMembre";
import { getNonLus } from "../api/messagerie";
import { compterNonVus } from "../utils/vus";

// Bulles de compteur sur la barre du bas (2026-09) — voir demande
// utilisateur : "des bulles indiquant... le nombre d'entrée pour les prise
// en charge... et message. Le nombre doit s'afficher sur l'icône de la
// rubrique." tabBarBadge est nativement géré par React Navigation.
//
// "Vu/non vu", pas juste "en attente" (2026-09) — voir demande
// utilisateur : "le symbole de notification... ne doit pas rester
// indéfiniment ainsi même quand il n'y a pas de retour... si on a déjà
// ouvert la rubrique et consulté, ça doit disparaître". priseEnChargeEnAttente
// (dashboard) est un STATUT métier qui ne bouge pas juste parce que
// l'utilisateur a regardé le dossier — remplacé par un comptage "non
// vus" côté appareil (voir utils/vus.ts), qui décroît dès qu'un dossier
// "en attente" a été ouvert au moins une fois.
// Remboursement/bon d'examen/ordonnance n'ont pas encore ce même comptage
// — seuls Prise en charge et Messagerie sont câblés ici ; les autres
// suivent le même principe, à étendre séparément. Vraies notifications
// système (push) : hors périmètre, nécessite un token Expo Push + un
// déclencheur côté backend.
const COMPTEURS_POLL_MS = 20_000;

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Accueil: "home-outline",
  PriseEnCharge: "clipboard-outline",
  Remboursement: "receipt-outline",
  Carnet: "medkit-outline",
  Plus: "grid-outline",
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Accueil: "Accueil",
  PriseEnCharge: "Prise en charge",
  Remboursement: "Remboursement",
  Carnet: "E-carnet",
  Plus: "Plus",
};

// Barre d'onglets du bas — 5 rubriques principales, le reste du
// menu du portail web (Ma carte, Mes garanties, Réseau de soins, Historique,
// Ma famille, Accès famille, Messagerie, Mon profil) vit dans "Plus".
export function MainTabs() {
  // Barre système Android (2026-09) — voir demande utilisateur : la barre
  // d'onglets restait à hauteur fixe (60), ignorant la barre de navigation
  // système du téléphone (boutons ou geste) qui se dessine par-dessus,
  // rendant les onglets difficiles à toucher. insets.bottom ajoute l'espace
  // réel de l'appareil sous la barre d'onglets.
  const insets = useSafeAreaInsets();
  const [pecEnAttente, setPecEnAttente] = useState(0);
  const [messagesNonLus, setMessagesNonLus] = useState(0);

  useEffect(() => {
    const rafraichir = () => {
      getMesPrisesEnChargePrealables()
        .then((accords) => {
          const enAttente = accords.filter((a) => a.decision === "En attente").map((a) => a.id);
          return compterNonVus("priseEnCharge", enAttente);
        })
        .then(setPecEnAttente)
        .catch(() => undefined);
      getNonLus().then(setMessagesNonLus).catch(() => undefined);
    };
    rafraichir();
    const id = setInterval(rafraichir, COMPTEURS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        tabBarStyle: { height: 60 + insets.bottom, paddingBottom: Math.max(8, insets.bottom), paddingTop: 6 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} size={size ?? 20} color={color} />
        ),
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
      })}
    >
      <Tab.Screen name="Accueil" component={DashboardScreen} />
      <Tab.Screen name="PriseEnCharge" component={PriseEnChargeListScreen} options={{ tabBarBadge: pecEnAttente > 0 ? pecEnAttente : undefined }} />
      <Tab.Screen name="Remboursement" component={RemboursementListScreen} />
      <Tab.Screen name="Carnet" component={CarnetSanteScreen} />
      <Tab.Screen name="Plus" component={PlusMenuScreen} options={{ tabBarBadge: messagesNonLus > 0 ? messagesNonLus : undefined }} />
    </Tab.Navigator>
  );
}

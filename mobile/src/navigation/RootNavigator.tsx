import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors } from "../theme/colors";
import type { RootStackParamList } from "./types";
import { MainTabs } from "./MainTabs";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { CarteScreen } from "../screens/carte/CarteScreen";
import { GarantiesScreen } from "../screens/garanties/GarantiesScreen";
import { PriseEnChargeDetailScreen } from "../screens/priseEnCharge/PriseEnChargeDetailScreen";
import { PriseEnChargeNouveauScreen } from "../screens/priseEnCharge/PriseEnChargeNouveauScreen";
import { RemboursementDetailScreen } from "../screens/remboursement/RemboursementDetailScreen";
import { RemboursementNouveauScreen } from "../screens/remboursement/RemboursementNouveauScreen";
import { ReseauSoinsListScreen } from "../screens/reseauSoins/ReseauSoinsListScreen";
import { ReseauSoinsDetailScreen } from "../screens/reseauSoins/ReseauSoinsDetailScreen";
import { HistoriqueScreen } from "../screens/historique/HistoriqueScreen";
import { HistoriqueDetailScreen } from "../screens/historique/HistoriqueDetailScreen";
import { FamilleScreen } from "../screens/famille/FamilleScreen";
import { FamilleMembreDetailScreen } from "../screens/famille/FamilleMembreDetailScreen";
import { DelegationsScreen } from "../screens/delegations/DelegationsScreen";
import { DelegationNouvelleScreen } from "../screens/delegations/DelegationNouvelleScreen";
import { DelegationGererScreen } from "../screens/delegations/DelegationGererScreen";
import { MessagerieListScreen } from "../screens/messagerie/MessagerieListScreen";
import { MessagerieConversationScreen } from "../screens/messagerie/MessagerieConversationScreen";
import { MonProfilScreen } from "../screens/profil/MonProfilScreen";
import { DocumentViewerScreen } from "../screens/documents/DocumentViewerScreen";
import { ChangementMotDePasseObligatoireScreen } from "../screens/auth/ChangementMotDePasseObligatoireScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigateur racine — écran de connexion si non authentifié, sinon les
// onglets principaux (MainTabs) + tous les écrans "détail/formulaire"
// poussés par-dessus (mêmes routes que src/layout/navConfig.ts vues
// membreXxx côté web, éclatées en écrans natifs distincts).
export function RootNavigator() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}>
      {!currentUser ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : currentUser.doitChangerMotDePasse ? (
        // Mot de passe temporaire (2026-09) — voir demande utilisateur : "la
        // saisie du mot de passe pour la première fois ne demande pas de
        // réinitialiser le mot de passe à la première connexion". Aucun
        // autre écran accessible tant que ce n'est pas résolu.
        <Stack.Screen name="ChangementMotDePasseObligatoire" component={ChangementMotDePasseObligatoireScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="CarteMembre" component={CarteScreen} options={{ title: "Ma carte" }} />
          <Stack.Screen name="Garanties" component={GarantiesScreen} options={{ title: "Mes garanties" }} />
          <Stack.Screen name="AccordDetail" component={PriseEnChargeDetailScreen} options={{ title: "Détail de la demande" }} />
          <Stack.Screen name="AccordNouveau" component={PriseEnChargeNouveauScreen} options={{ title: "Nouvelle demande" }} />
          <Stack.Screen name="RemboursementDetail" component={RemboursementDetailScreen} options={{ title: "Détail" }} />
          <Stack.Screen name="RemboursementNouveau" component={RemboursementNouveauScreen} options={{ title: "Nouvelle demande" }} />
          <Stack.Screen name="ReseauSoins" component={ReseauSoinsListScreen} options={{ title: "Réseau de soins" }} />
          <Stack.Screen name="ReseauSoinsDetail" component={ReseauSoinsDetailScreen} options={{ title: "Prestataire" }} />
          <Stack.Screen name="Historique" component={HistoriqueScreen} options={{ title: "Historique de soins" }} />
          <Stack.Screen name="HistoriqueDetail" component={HistoriqueDetailScreen} options={{ title: "Détail" }} />
          <Stack.Screen name="Famille" component={FamilleScreen} options={{ title: "Ma famille" }} />
          <Stack.Screen name="FamilleMembreDetail" component={FamilleMembreDetailScreen} options={{ title: "Bénéficiaire" }} />
          <Stack.Screen name="Delegations" component={DelegationsScreen} options={{ title: "Accès famille" }} />
          <Stack.Screen name="DelegationNouvelle" component={DelegationNouvelleScreen} options={{ title: "Donner un accès" }} />
          <Stack.Screen name="DelegationGerer" component={DelegationGererScreen} options={{ title: "Gérer l'accès" }} />
          <Stack.Screen name="MessagerieListe" component={MessagerieListScreen} options={{ title: "Messagerie" }} />
          <Stack.Screen name="MessagerieConversation" component={MessagerieConversationScreen} options={{ title: "Conversation" }} />
          <Stack.Screen name="MonProfil" component={MonProfilScreen} options={{ title: "Mon profil" }} />
          <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

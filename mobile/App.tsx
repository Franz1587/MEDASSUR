import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { AuthProvider } from "./src/auth/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

// Application immédiate des mises à jour OTA (2026-09) — voir demande
// utilisateur : un correctif publié (ex. changement de mot de passe
// obligatoire) semblait "ne pas être effectif". Comportement PAR DÉFAUT
// d'expo-updates : une mise à jour est téléchargée en arrière-plan au
// lancement, mais seulement appliquée au PROCHAIN lancement complet — un
// utilisateur qui rouvre l'app une seule fois après publication voit encore
// l'ancien code, il faut fermer/rouvrir une seconde fois. Ici, on vérifie et
// applique la mise à jour dès ce lancement (téléchargement + rechargement
// immédiat si une nouvelle version existe) — un seul cycle fermer/rouvrir
// suffit désormais. Jamais bloquant : indisponible en dev (__DEV__) ou sans
// réseau, l'app continue simplement sur la version déjà installée.
function useAppliquerMiseAJourImmediate() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (!isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        // Pas de réseau, ou déjà à jour — l'app continue normalement.
      }
    })();
  }, []);
}

// Notification reçue app ouverte (2026-09) — voir demande utilisateur :
// notifications système même hors de l'app (voir utils/pushNotifications.ts
// pour l'enregistrement du jeton). Sans ce handler, une notification reçue
// pendant que l'app est au premier plan ne s'affiche jamais (comportement
// par défaut d'expo-notifications) — on la montre quand même (bannière +
// son), cohérent avec l'attente "être informé des nouvelles entrées".
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Point d'entrée MEDASSUR mobile — réplique native de l'Espace Assuré du
// portail web (PortalShell.tsx + src/features/portail-membre/*.tsx), même
// backend de production (https://medassur.cloud/api).
export default function App() {
  useAppliquerMiseAJourImmediate();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

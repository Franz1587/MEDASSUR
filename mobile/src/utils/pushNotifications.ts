import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { http } from "../api/http";

// Notifications système (2026-09) — voir demande utilisateur : "l'application
// mobile doit pouvoir activer les notifications sur le smartphone afin que
// l'assuré soit informé des nouvelles entrées même quand il n'est pas dans
// l'application". Enregistre le jeton Expo Push de CET appareil auprès du
// backend (voir POST /portail-membre/push-token) une fois connecté — le
// backend déclenche ensuite l'envoi réel (voir PushNotificationsService,
// backend/src/notifications) sur les événements pertinents (décision de
// prise en charge, nouveau message...). Jamais bloquant pour le reste de
// l'app : un refus de permission ou un échec réseau ne doit jamais empêcher
// l'utilisateur de se connecter/utiliser l'application normalement.
export async function enregistrerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulateur/émulateur : pas de vrai jeton push
    const { status: statutExistant } = await Notifications.getPermissionsAsync();
    let statut = statutExistant;
    if (statut !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      statut = status;
    }
    if (statut !== "granted") return;

    if (Platform.OS === "android") {
      // sound explicite : sans lui, certains OEM (notamment sur Android 8+,
      // où le son dépend du canal et non du payload push) laissent la
      // notification arriver silencieusement — voir aussi channelId ajouté
      // côté serveur (backend/src/notifications/push-notifications.service.ts).
      await Notifications.setNotificationChannelAsync("default", {
        name: "MedAssur",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: "#0a426f",
        sound: "default",
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await http.post("/portail-membre/push-token", { token: expoPushToken, plateforme: Platform.OS });
  } catch {
    // Jamais bloquant — voir commentaire ci-dessus.
  }
}

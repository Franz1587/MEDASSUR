import * as Location from "expo-location";

export interface Position {
  latitude: number;
  longitude: number;
}

// Utilisé pour situer l'utilisateur sur la carte du réseau de soins
// ("géolocaliser un prestataire par rapport à ma position"). Ne lève
// jamais : si la permission est refusée ou le GPS indisponible, la carte
// s'affiche simplement sans le repère "Votre position".
export async function obtenirPositionActuelle(): Promise<Position | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

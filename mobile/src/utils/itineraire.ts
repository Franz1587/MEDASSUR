import { Platform, Linking } from "react-native";

// Déclenche l'itinéraire vers un prestataire dans l'application de
// navigation du téléphone — voir demande utilisateur : "déclencher
// l'itinéraire afin d'aller chez le prestataire". Tente d'abord l'app de
// cartes native (Google Maps sur Android, Plans sur iOS, avec guidage
// routier) ; repli sur le lien Google Maps universel si l'app native n'est
// pas installée ou le schéma indisponible — fonctionne alors dans le
// navigateur.
export async function ouvrirItineraire(latitude: number, longitude: number, libelle?: string): Promise<void> {
  const nom = libelle ? encodeURIComponent(libelle) : "";
  const urlNative = Platform.select({
    ios: `maps://?daddr=${latitude},${longitude}&dirflg=d`,
    android: `google.navigation:q=${latitude},${longitude}`,
    default: "",
  });
  const urlUniverselle = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}${nom ? `&destination_place_id=&dir_action=navigate` : ""}`;

  try {
    if (urlNative) {
      const supportee = await Linking.canOpenURL(urlNative);
      if (supportee) {
        await Linking.openURL(urlNative);
        return;
      }
    }
    await Linking.openURL(urlUniverselle);
  } catch {
    await Linking.openURL(urlUniverselle).catch(() => undefined);
  }
}

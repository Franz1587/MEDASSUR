import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

// Carte interactive en WebView + Leaflet/OpenStreetMap.
//
// react-native-maps a été retiré (2026-09) : sur Android, ce module exige
// systématiquement le SDK natif Google Maps (même avec PROVIDER_DEFAULT),
// qui lui-même exige une clé d'API Google Cloud déclarée dans le manifeste
// (android.config.googleMaps.apiKey). Cette clé n'a jamais été configurée
// (nécessite un compte + facturation côté utilisateur) : sans elle, le SDK
// Google Maps ne se contente plus d'afficher une carte vide — il fait
// planter l'application au montage de <MapView>. Une carte 100% WebView
// (Leaflet + tuiles OpenStreetMap, gratuites, sans clé) élimine ce risque
// tout en gardant le même fond de carte déjà utilisé ailleurs.
export interface PointCarte {
  id: string;
  latitude: number;
  longitude: number;
  titre: string;
  description?: string;
}

interface Props {
  points: PointCarte[];
  position?: { latitude: number; longitude: number } | null;
  onMarkerPress?: (id: string) => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  // Zoom fixe (2026-09) — voir demande utilisateur : "on ne peut pas voir
  // avec exactitude où est le prestataire". Sans ce réglage, la présence de
  // la position de l'utilisateur déclenchait un fitBounds qui dézoomait
  // pour englober les deux points, rendant l'emplacement exact du
  // prestataire imprécis dès que l'utilisateur était un peu loin. Quand
  // `zoom` est fourni, la carte reste centrée et zoomée précisément sur le
  // premier point (le prestataire), sans réajustement automatique.
  zoom?: number;
}

function echapper(valeur: string): string {
  return valeur.replace(/[<>]/g, "");
}

function construireHtml(points: PointCarte[], position: Props["position"], interactive: boolean, zoomFixe?: number): string {
  const pointsSurs = points.map((p) => ({ ...p, titre: echapper(p.titre), description: p.description ? echapper(p.description) : undefined }));
  const pointsJson = JSON.stringify(pointsSurs);
  const positionJson = JSON.stringify(position ?? null);
  const centre = points[0] ? { latitude: points[0].latitude, longitude: points[0].longitude } : (position ?? { latitude: 0.39, longitude: 9.45 });
  const zoomInitial = zoomFixe ?? (points.length > 0 || position ? 13 : 6);
  const ajusterAutomatiquement = zoomFixe === undefined;
  const inter = interactive ? "true" : "false";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #carte { height: 100%; margin: 0; padding: 0; background: #e9edf2; }
  .marqueur-utilisateur { background: #1a73e8; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 4px rgba(0,0,0,0.45); }
  /* Bouton de rotation (leaflet-rotate n'inclut pas de CSS dédié) — glisser
     l'aiguille pour orienter la carte, ou geste à deux doigts. */
  .leaflet-control-rotate { width: 30px; height: 30px; background: #fff; cursor: grab; }
  .leaflet-control-rotate-toggle { display: block; width: 100%; height: 100%; }
  .leaflet-control-rotate-arrow {
    display: block; width: 100%; height: 100%; position: relative;
  }
  .leaflet-control-rotate-arrow::after {
    content: ''; position: absolute; left: 50%; top: 4px; width: 2px; height: 12px;
    background: #d64545; transform: translateX(-50%);
  }
  .leaflet-control-rotate-arrow::before {
    content: ''; position: absolute; left: 50%; bottom: 4px; width: 2px; height: 10px;
    background: #9aa5ad; transform: translateX(-50%);
  }
</style>
</head>
<body>
<div id="carte"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
<script>
  try {
    var points = ${pointsJson};
    var position = ${positionJson};
    var carte = L.map('carte', {
      zoomControl: ${inter}, dragging: ${inter}, scrollWheelZoom: ${inter},
      doubleClickZoom: ${inter}, touchZoom: ${inter}, boxZoom: ${inter}, keyboard: false,
      // Rotation (2026-09) — voir demande utilisateur : "faire des
      // rotations à la carte pour changer l'axe de vue". Plugin
      // leaflet-rotate : rotateControl affiche le petit bouton boussole
      // (glisser pour orienter) ; touchRotate active le geste à deux
      // doigts. Jamais activé sur une carte non interactive (aperçu figé).
      rotate: ${inter}, touchRotate: ${inter}, rotateControl: ${inter}, bearing: 0,
    }).setView([${centre.latitude}, ${centre.longitude}], ${zoomInitial});

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(carte);

    var bornes = [];
    points.forEach(function (p) {
      var marqueur = L.marker([p.latitude, p.longitude]).addTo(carte);
      var contenu = '<b>' + p.titre + '</b>' + (p.description ? '<br/>' + p.description : '');
      marqueur.bindPopup(contenu);
      marqueur.on('click', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marqueur', id: p.id }));
        }
      });
      bornes.push([p.latitude, p.longitude]);
    });

    if (position) {
      var icone = L.divIcon({ className: 'marqueur-utilisateur', iconSize: [16, 16], html: '' });
      L.marker([position.latitude, position.longitude], { icon: icone, zIndexOffset: 1000 })
        .addTo(carte)
        .bindPopup('Votre position');
      bornes.push([position.latitude, position.longitude]);
    }

    if (bornes.length > 1 && ${ajusterAutomatiquement}) {
      carte.fitBounds(bornes, { padding: [32, 32] });
    }
  } catch (e) {
    document.getElementById('carte').innerText = 'Carte indisponible';
  }
</script>
</body>
</html>`;
}

export function LeafletMap({ points, position, onMarkerPress, interactive = true, style, zoom }: Props) {
  const html = useMemo(
    () => construireHtml(points, position ?? null, interactive, zoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(points), position?.latitude, position?.longitude, interactive, zoom],
  );

  return (
    <View style={[styles.conteneur, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data?.type === "marqueur" && data.id && onMarkerPress) onMarkerPress(data.id);
          } catch {
            // ignore
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, overflow: "hidden" },
  webview: { flex: 1, backgroundColor: "transparent" },
});

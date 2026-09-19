import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite ne résout pas les chemins d'images relatifs codés en dur dans le
// plugin Leaflet — sans ce correctif, le marqueur par défaut est invisible
// (icône manquante) une fois empaqueté. Import à faire une seule fois, au
// premier écran qui affiche une carte (voir ReseauSoins.tsx).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Distance à vol d'oiseau (formule de haversine) — utilisé pour dire
// précisément quels prestataires sont à proximité de la position de
// l'utilisateur (voir demande utilisateur : "l'application doit être
// capable de nous dire précisément quelles sont les prestataires qui sont
// vraiment à proximité par rapport à ma position").
export interface Coordonnee {
  latitude: number;
  longitude: number;
}

function versRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceKm(a: Coordonnee, b: Coordonnee): number {
  const R = 6371;
  const dLat = versRadians(b.latitude - a.latitude);
  const dLon = versRadians(b.longitude - a.longitude);
  const lat1 = versRadians(a.latitude);
  const lat2 = versRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formaterDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

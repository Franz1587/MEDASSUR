// Bulle de notification du bandeau (2026-08) — voir AdminShell.tsx et
// backend/src/notifications. Toujours filtrées côté serveur sur
// l'utilisateur authentifié (jamais toutes les notifications de tous les
// utilisateurs).
export interface AppNotification {
  id: string;
  destinataireType: string;
  destinataireId: string;
  message: string;
  statut: "Envoyée" | "Lue" | string;
  dateEnvoi: string;
}

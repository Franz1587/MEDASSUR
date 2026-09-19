import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Notifications système mobiles (2026-09) — voir demande utilisateur :
// "l'application mobile doit pouvoir activer les notifications sur le
// smartphone afin que l'assuré soit informé des nouvelles entrées même
// quand il n'est pas dans l'application". Utilise le service Push
// d'Expo (https://exp.host/--/api/v2/push/send) — gratuit, aucune clé
// requise côté serveur pour un envoi simple (contrairement à Zavu/SMS, voir
// MessagingService, même principe d'échec silencieux/jamais bloquant).
// N'envoie QUE si User.pushToken est renseigné (voir
// PortailMembreController.enregistrerPushToken) — repli silencieux sinon,
// jamais une erreur qui remonterait au workflow métier appelant (une
// décision de prise en charge, un nouveau message... doivent aboutir même
// si l'envoi push échoue).
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async envoyerAUtilisateur(userId: string, titre: string, corps: string, data?: Record<string, unknown>): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
      if (!user?.pushToken) return;
      await this.envoyerAuJeton(user.pushToken, titre, corps, data);
    } catch (err) {
      this.logger.warn(`Envoi push échoué pour l'utilisateur ${userId}: ${(err as Error).message}`);
    }
  }

  // Réservé aux comptes portail EXTERNES (assuré/prestataire) — voir demande
  // utilisateur explicite sur l'assuré ; même mécanisme réutilisable pour un
  // futur portail prestataire sans dupliquer la logique d'appel Expo.
  private async envoyerAuJeton(token: string, titre: string, corps: string, data?: Record<string, unknown>): Promise<void> {
    if (!token.startsWith("ExponentPushToken")) return; // jeton mal formé — jamais envoyé à l'aveugle
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      // channelId requis côté Android (8+) : sur ces versions, le son/la
      // vibration ne dépendent PAS du champ "sound" du payload mais des
      // réglages du canal de notification. Sans channelId explicite ici,
      // Expo ne route pas vers le canal "default" créé côté app (voir
      // mobile/src/utils/pushNotifications.ts) et la notification arrive
      // silencieuse — cause du signalement utilisateur "ça reste silencieux".
      body: JSON.stringify([{
        to: token, title: titre, body: corps, data: data ?? {},
        sound: "default", priority: "high", channelId: "default",
      }]),
    });
    if (!res.ok) this.logger.warn(`Expo Push a répondu ${res.status} pour un envoi.`);
  }
}

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushNotificationsService } from "../notifications/push-notifications.service";
import { MessagerieAgentIaService } from "./agent-ia.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import type { RoleId } from "../auth/role.enum";
import { CreateConversationDto } from "./dto/create-conversation.dto";

const UPLOADS_MESSAGERIE_DIR = path.join(UPLOADS_ROOT, "messagerie");

// Rôles internes (2026-08) — voir demande utilisateur : "il faut créer pour
// tous les acteurs ou utilisateur un onglet de Messagerie" : détermine si le
// compte connecté est un agent MedAssur (voit la file, peut la réclamer) ou
// un externe (assuré/client/prestataire, ne voit que SES propres
// conversations) — même famille "interne" que src/auth/roles.ts, dupliquée
// ici comme le reste des taxonomies de rôles dans ce backend.
const ROLES_INTERNES: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante",
  "gestionnaire_entreprises", "comptable", "commercial", "agent_recouvrement",
];

// Rôles notifiés d'une nouvelle conversation "Humain" (2026-08) — file
// partagée, premier arrivé premier servi, même principe que
// ROLES_GESTION_DEMANDES_CLIENT (demandes-client.service.ts) : notifie un
// sous-ensemble pertinent plutôt que TOUS les agents internes (l'onglet
// Messagerie, lui, reste ouvert à tous — voir ROLES_INTERNES ci-dessus).
const ROLES_MESSAGERIE_NOTIFIEES: RoleId[] = [
  "administrateur", "direction_generale", "directeur_technique",
  "gestionnaire_production", "gestionnaire_sinistres", "gestionnaire_sante", "gestionnaire_entreprises",
];

export function estRoleInterne(roleId: string): boolean {
  return ROLES_INTERNES.includes(roleId as RoleId);
}

@Injectable()
export class MessagerieService {
  constructor(
    private prisma: PrismaService, private notifications: NotificationsService, private agentIa: MessagerieAgentIaService,
    private storage: StorageService, private pushNotifications: PushNotificationsService,
  ) {}

  async creer(dto: CreateConversationDto, demandeurId: string, demandeurRole: string) {
    // Un agent interne qui ouvre lui-même une conversation le fait toujours
    // vers un autre agent (jamais vers l'IA) — le choix "IA"/"Humain" n'a
    // de sens que pour un externe qui contacte l'assurance.
    const canal = estRoleInterne(demandeurRole) ? "Humain" : dto.canal;
    const conversation = await this.prisma.conversation.create({
      data: {
        objet: dto.objet.trim(),
        demandeurId, demandeurRole, canal,
        statut: canal === "IA" ? "EnCoursIA" : "Ouverte",
        messages: { create: { auteurId: demandeurId, auteurType: "Utilisateur", contenu: dto.message.trim() } },
      },
      include: { messages: true },
    });

    if (canal === "Humain") await this.notifierFileInterne(conversation.id, dto.objet);
    // Réponse automatique de l'agent IA (2026-08) — best-effort, jamais
    // bloquant pour la création de la conversation (voir agent-ia.service.ts,
    // repondre() se dégrade silencieusement sans ANTHROPIC_API_KEY).
    if (canal === "IA") this.agentIa.repondre(conversation.id).catch(() => undefined);
    return conversation;
  }

  private async notifierFileInterne(conversationId: string, objet: string) {
    const destinataires = await this.prisma.user.findMany({ where: { roleId: { in: ROLES_MESSAGERIE_NOTIFIEES } }, select: { id: true } });
    await Promise.all(
      destinataires.map((u) =>
        this.notifications.create("Gestionnaire", u.id, `Nouveau message (${conversationId}) : ${objet}`).catch(() => undefined),
      ),
    );
  }

  // Liste scopée (2026-08) — externe : uniquement ses propres conversations.
  // Interne : celles qu'il a déjà prises en charge + la file partagée non
  // encore réclamée. Inclut désormais aussi "EnCoursIA" (2026-09 — voir
  // demande utilisateur : "rendre possible les échanges de messagerie entre
  // l'agent IA et l'agent Humain du client") : avant ce correctif, un agent
  // interne ne voyait JAMAIS une conversation tant que l'IA ne l'escaladait
  // pas elle-même (escalader_vers_humain, voir agent-ia.service.ts) — aucun
  // moyen d'intervenir proactivement sur un dossier en cours de traitement
  // automatique. Le frontend (Messagerie.tsx) affichait déjà le badge
  // "En cours (auto)"/l'icône Bot pour ce cas, sans jamais pouvoir le
  // recevoir : la bascule vers un agent humain qui répond fonctionnait déjà
  // (voir envoyerMessage plus bas, patchAssignation) — seule la VISIBILITÉ
  // manquait.
  async liste(userId: string, roleId: string) {
    if (estRoleInterne(roleId)) {
      return this.prisma.conversation.findMany({
        where: { OR: [{ assigneAId: userId }, { assigneAId: null, statut: { in: ["Ouverte", "EnCoursIA", "EnCoursHumain"] } }] },
        orderBy: { updatedAt: "desc" },
      });
    }
    return this.prisma.conversation.findMany({ where: { demandeurId: userId }, orderBy: { updatedAt: "desc" } });
  }

  private async conversationAccessible(id: string, userId: string, roleId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundException(`Conversation ${id} introuvable`);
    const autorise = estRoleInterne(roleId) ? (conversation.assigneAId === null || conversation.assigneAId === userId) : conversation.demandeurId === userId;
    if (!autorise) throw new ForbiddenException(`Conversation ${id} inaccessible`);
    return conversation;
  }

  async messages(id: string, userId: string, roleId: string) {
    await this.conversationAccessible(id, userId, roleId);
    return this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { dateEnvoi: "asc" } });
  }

  async envoyerMessage(id: string, userId: string, roleId: string, contenu: string, file?: Express.Multer.File) {
    const conversation = await this.conversationAccessible(id, userId, roleId);
    if (!contenu?.trim() && !file) throw new BadRequestException("Message vide.");

    let pieceJointe: string | undefined;
    if (file) {
      const ext = path.extname(file.originalname) || "";
      pieceJointe = `${id}-${Date.now()}-${randomUUID().slice(0, 6)}${ext.toLowerCase()}`;
      if (this.storage.actif) {
        await this.storage.upload("messagerie", pieceJointe, file.buffer, file.mimetype);
      } else {
        await fs.promises.mkdir(UPLOADS_MESSAGERIE_DIR, { recursive: true });
        await fs.promises.writeFile(path.join(UPLOADS_MESSAGERIE_DIR, pieceJointe), file.buffer);
      }
    }

    const auteurType = estRoleInterne(roleId) ? "Agent" : "Utilisateur";
    // Un agent qui répond à une conversation encore dans la file la
    // réclame implicitement à ce moment-là (2026-08) — évite un double
    // aller-retour "Prendre" puis "Répondre" pour le cas courant.
    const patchAssignation = estRoleInterne(roleId) && conversation.assigneAId === null ? { assigneAId: userId } : {};
    await this.prisma.conversation.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        statut: estRoleInterne(roleId) ? "EnCoursHumain" : conversation.statut,
        ...patchAssignation,
      },
    });
    // Await OBLIGATOIRE (2026-08 — bug trouvé en testant traiter_demande_
    // garantie) : repondre() relit l'historique en base pour construire les
    // tours user/assistant envoyés au modèle. Sans ce await, l'INSERT de CE
    // message n'était pas garanti d'être visible quand repondre() lançait
    // sa lecture juste après (fire-and-forget), provoquant une vraie
    // course : repondre() ne voyait alors que le message IA précédent (le
    // seul "assistant") et l'API rejetait l'appel ("This model does not
    // support assistant message prefill. The conversation must end with a
    // user message.") — silencieusement avalé par le .catch(), donc invisible
    // pour l'interlocuteur qui ne recevait simplement jamais de réponse.
    const cree = await this.prisma.message.create({
      data: { conversationId: id, auteurId: userId, auteurType, contenu: contenu?.trim() ?? "", pieceJointe },
    });
    // Relance de l'agent IA (2026-08) — un demandeur qui répond dans une
    // conversation encore "EnCoursIA" (pas escaladée) obtient une nouvelle
    // réponse automatique, même mécanisme qu'à l'ouverture (voir creer()).
    if (auteurType === "Utilisateur" && conversation.canal === "IA" && conversation.statut === "EnCoursIA") {
      this.agentIa.repondre(id).catch(() => undefined);
    }
    // Notification système (2026-09) — voir demande utilisateur : "informé
    // des nouvelles entrées même quand il n'est pas dans l'application" —
    // ici pour la réponse d'un vrai conseiller humain (le cas de l'IA est
    // couvert dans agent-ia.service.ts repondre()). Jamais vers soi-même :
    // seul le demandeur d'origine (l'externe) reçoit cette notification.
    if (auteurType === "Agent" && cree.contenu) {
      this.pushNotifications.envoyerAUtilisateur(conversation.demandeurId, "MedAssur", cree.contenu.slice(0, 180), { conversationId: id }).catch(() => undefined);
    }
    return cree;
  }

  async prendre(id: string, userId: string, roleId: string) {
    if (!estRoleInterne(roleId)) throw new ForbiddenException("Réservé aux agents internes.");
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundException(`Conversation ${id} introuvable`);
    if (conversation.assigneAId && conversation.assigneAId !== userId) throw new BadRequestException("Déjà prise en charge par un autre agent.");
    return this.prisma.conversation.update({ where: { id }, data: { assigneAId: userId, statut: "EnCoursHumain" } });
  }

  async changerStatut(id: string, userId: string, roleId: string, statut: string) {
    await this.conversationAccessible(id, userId, roleId);
    const mise = await this.prisma.conversation.update({ where: { id }, data: { statut } });
    // "Apprentissage" (2026-09) — voir agent-ia.service.ts
    // apprendreDeLaResolution : déclenché UNE fois, à la clôture réelle de
    // la conversation, fire-and-forget (jamais bloquant pour ce changement
    // de statut lui-même).
    if (statut === "Resolue") this.agentIa.apprendreDeLaResolution(id).catch(() => undefined);
    return mise;
  }

  // Compteur de messages non lus (2026-08) — voir demande utilisateur : "un
  // onglet messagerie qui... s'actualise toutes les 15s avec une bulle
  // d'indication de nouveau message" : "non lus" = messages d'AUTRUI dans
  // mes conversations, jamais les miens propres.
  //
  // BUG CORRIGÉ (2026-08) — voir demande utilisateur : "les notifications,
  // ni les bulles d'indication de nouveau message ne s'affichent pas."
  // `auteurId: { not: userId }` semblait couvrir "tout message qui n'est
  // pas de moi", mais les messages d'Ariana (auteurType "IA") ont
  // auteurId=null — et en SQL, NULL <> 'userId' n'est ni vrai ni faux
  // (logique à trois valeurs), donc ces lignes étaient SILENCIEUSEMENT
  // exclues par Prisma. Résultat : la bulle ne comptait jamais les réponses
  // de l'IA, qui sont pourtant l'essentiel des messages reçus côté assuré/
  // prestataire — le compteur restait à 0 même avec des messages réellement
  // non lus. Il faut explicitement inclure auteurId=null (OR) en plus de
  // "différent de moi".
  private readonly AUTEUR_AUTRUI = (userId: string) => ({ OR: [{ auteurId: null }, { auteurId: { not: userId } }] });

  async nonLus(userId: string, roleId: string): Promise<number> {
    const mesConversations = await this.liste(userId, roleId);
    if (mesConversations.length === 0) return 0;
    return this.prisma.message.count({
      where: { conversationId: { in: mesConversations.map((c) => c.id) }, lu: false, ...this.AUTEUR_AUTRUI(userId) },
    });
  }

  async marquerLus(id: string, userId: string, roleId: string) {
    await this.conversationAccessible(id, userId, roleId);
    await this.prisma.message.updateMany({ where: { conversationId: id, ...this.AUTEUR_AUTRUI(userId) }, data: { lu: true } });
  }
}

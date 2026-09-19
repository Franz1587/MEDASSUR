import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // identifiant (2026-08) — un compte assure_principal (assuré principal OU
  // ayant droit délégué, voir DelegationsFamilleService) se connecte par
  // matricule, email ou téléphone (voir demande utilisateur : "l'accès au
  // compte assuré ou ayant droit doit pouvoir se faire par le numéro
  // matricule, l'adresse mail... ou le numéro de téléphone") — jamais par
  // User.email, qui reste une adresse interne synthétique pour ces comptes
  // (voir ComptesMobileService.generer/DelegationsFamilleService.accorder).
  // Les 3 canaux sont donc résolus via AssureSante, pas via User. Ambiguïté
  // (ex. un numéro de téléphone qui désignerait deux comptes) → refusé
  // plutôt que de choisir arbitrairement : c'est ce mécanisme qui impose à
  // un ayant droit délégué par téléphone d'avoir un numéro DISTINCT de celui
  // de l'assuré principal (voir demande utilisateur). Tous les autres rôles
  // continuent de se connecter par User.email, inchangé.
  async login(identifiant: string, password: string) {
    let user = await this.prisma.user.findUnique({ where: { email: identifiant } });

    if (!user) {
      const candidats = await this.prisma.user.findMany({
        where: {
          roleId: "assure_principal",
          assureSante: { OR: [{ matricule: identifiant }, { telephone: identifiant }, { email: identifiant }] },
        },
      });
      if (candidats.length > 1) {
        throw new UnauthorizedException("Plusieurs comptes correspondent à cet identifiant — contactez votre assureur.");
      }
      user = candidats[0] ?? null;
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    // Société suspendue (2026-09) — voir demande utilisateur : Super Admin,
    // Phase 1 du chantier multi-tenant. Un compte super_admin (societeId
    // NULL) n'est jamais concerné. Vérifié ici plutôt qu'un simple flag sur
    // User : une société peut être suspendue APRÈS la création de ses
    // comptes, tous doivent être bloqués d'un coup, pas un par un.
    if (user.societeId) {
      const societe = await this.prisma.societeAssurance.findUnique({ where: { id: user.societeId } });
      if (societe?.statut === "Suspendu") {
        throw new UnauthorizedException(`Accès suspendu pour votre société${societe.motifSuspension ? ` (${societe.motifSuspension})` : ""} — contactez l'administrateur de la plateforme.`);
      }
    }

    // Dernière connexion (2026-09) — voir demande utilisateur : "un écran
    // lui permettant de voir les performances d'utilisation de
    // l'application" (Super Admin). En tâche de fond (jamais attendu) —
    // une panne d'écriture ne doit jamais faire échouer une connexion.
    this.prisma.user.update({ where: { id: user.id }, data: { derniereConnexion: new Date() } }).catch(() => undefined);

    // clientId/assureSanteId/prestataireId (2026-08) — rattachent un compte
    // de portail (client, assuré ou prestataire) à SES seules données (voir
    // schema.prisma User.clientId/assureSanteId/prestataireId) : portés par
    // le JWT pour que chaque endpoint du portail puisse vérifier la
    // propriété des données sans requête supplémentaire (voir
    // PortailClientController/PortailMembreController/PortailPrestataireController).
    const payload = {
      sub: user.id, email: user.email, nom: user.nom, roleId: user.roleId,
      clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
      medecinId: user.medecinId, societeId: user.societeId,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, initiales: user.initiales,
        modules: user.modules, clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
        medecinId: user.medecinId, societeId: user.societeId, doitChangerMotDePasse: user.doitChangerMotDePasse,
      },
    };
  }

  // Rafraîchissement de session (2026-09) — voir demande utilisateur : les
  // droits/modules d'un compte peuvent changer PENDANT qu'il est connecté
  // (Super Admin qui étend/réduit un abonnement, administrateur qui modifie
  // les droits d'un collaborateur) — sans ce point d'entrée, le menu latéral
  // restait figé sur l'instantané `User.modules` capturé à la connexion
  // jusqu'à une déconnexion/reconnexion explicite. Utilisé par AuthContext
  // au montage (et sur un retour d'onglet) pour resynchroniser `modules`
  // sans redemander de mot de passe.
  async moi(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Compte introuvable");
    return {
      id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, initiales: user.initiales,
      modules: user.modules, clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
      medecinId: user.medecinId, societeId: user.societeId, doitChangerMotDePasse: user.doitChangerMotDePasse,
    };
  }
}

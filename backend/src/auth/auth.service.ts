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
    const identifiantNettoye = identifiant.trim();
    const emailNormalisee = identifiantNettoye.toLowerCase();

    let user = await this.prisma.user.findFirst({
      where: { email: { equals: emailNormalisee, mode: "insensitive" } },
    });

    // Connexion par pseudo (2026-11) — voir demande utilisateur : "rendre
    // possible la connexion par un pseudo pour aller plus vite". Testé
    // APRÈS email car la majorité des comptes admin se connecte par email.
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { username: { equals: identifiantNettoye, mode: "insensitive" } },
      });
    }

    if (!user) {
      // Connexion par téléphone (2026-09) — voir demande utilisateur : "je
      // remarque que le numéro de téléphone ne passe pas." Le numéro tapé
      // à la connexion et celui stocké (AssureSante.telephone, jamais
      // normalisé à la saisie/import — juste .trim()) ne coïncidaient que
      // si formatés à l'IDENTIQUE (espaces, tirets, indicatif +241, 0
      // initial). Comparaison désormais sur les 8 DERNIERS CHIFFRES
      // uniquement (chiffres purs des deux côtés, mise en forme/indicatif
      // ignorés) — $queryRaw nécessaire, Prisma ne sait pas filtrer sur une
      // valeur de colonne normalisée à la volée (même patron $queryRaw que
      // documents.service.ts/import.service.ts pour les séquences).
      const suffixeTelephone = identifiantNettoye.replace(/\D/g, "").slice(-8);
      const candidatsTelephone = suffixeTelephone.length === 8
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT u.id FROM "User" u
            JOIN "AssureSante" a ON a.id = u."assureSanteId"
            WHERE u."roleId" = 'assure_principal'
            AND a.telephone IS NOT NULL
            AND right(regexp_replace(a.telephone, '\D', '', 'g'), 8) = ${suffixeTelephone}
          `
        : [];

      const candidats = await this.prisma.user.findMany({
        where: {
          roleId: "assure_principal",
          OR: [
            { assureSante: { matricule: { equals: identifiantNettoye, mode: "insensitive" } } },
            { assureSante: { email: { equals: emailNormalisee, mode: "insensitive" } } },
            ...(candidatsTelephone.length > 0 ? [{ id: { in: candidatsTelephone.map((c) => c.id) } }] : []),
          ],
        },
      });
      if (candidats.length > 1) {
        throw new UnauthorizedException("Plusieurs comptes correspondent à cet identifiant — contactez votre assureur.");
      }
      user = candidats[0] ?? null;
    }

    // Connexion par code praticien (2026-11) — voir demande utilisateur :
    // "les médecins puisse se connecter... avec le numéro de prescripteur +
    // un mot de passe". Résout le Medecin par codePraticien exact, puis remonte
    // au User via la relation medecinId.
    if (!user) {
      const medecin = await this.prisma.medecin.findFirst({
        where: { codePraticien: { equals: identifiantNettoye, mode: "insensitive" } },
        select: { id: true },
      });
      if (medecin) {
        user = await this.prisma.user.findFirst({ where: { medecinId: medecin.id } });
      }
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

    // Structures médicales du médecin (2026-11) — voir demande utilisateur :
    // "si lié à plusieurs structures, l'application ouvre une fenêtre pour
    // sélectionner la structure pour lequel il s'apprête à faire une
    // consultation." Incluses dans la réponse login quand medecinId est défini,
    // pour que le frontend affiche le modal de choix immédiatement après login.
    let structuresMedecin: { id: string; nom: string }[] | undefined;
    if (user.medecinId) {
      const med = await this.prisma.medecin.findUnique({
        where: { id: user.medecinId },
        select: { structures: { select: { prestataire: { select: { id: true, nom: true } } } } },
      });
      structuresMedecin = med?.structures.map((s) => s.prestataire) ?? [];
    }

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, initiales: user.initiales,
        modules: user.modules, clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
        medecinId: user.medecinId, societeId: user.societeId, doitChangerMotDePasse: user.doitChangerMotDePasse,
        consentementAccepteAt: user.consentementAccepteAt?.toISOString() ?? null,
      },
      structuresMedecin,
    };
  }

  async moi(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Compte introuvable");
    return {
      id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, initiales: user.initiales,
      modules: user.modules, clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
      medecinId: user.medecinId, societeId: user.societeId, doitChangerMotDePasse: user.doitChangerMotDePasse,
      consentementAccepteAt: user.consentementAccepteAt?.toISOString() ?? null,
    };
  }

  async accepterConsentement(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { consentementAccepteAt: new Date() },
    });
    return { ok: true };
  }
}

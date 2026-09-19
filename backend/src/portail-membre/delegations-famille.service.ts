import * as bcrypt from "bcryptjs";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { GrantDelegationDto } from "./dto/grant-delegation.dto";

// Rubriques accordables à un ayant droit délégué — jamais "membreDelegations"
// elle-même (2026-08) — voir demande utilisateur : seul l'assuré principal
// racine gère les accès de sa famille, jamais un ayant droit délégué (même
// s'il partage le même roleId "assure_principal" côté auth).
const MODULES_DELEGABLES = ROLE_MODULES.assure_principal.filter((m) => m !== "membreDelegations");

const SELECT_SANS_HASH = { id: true, roleId: true, nom: true, email: true, initiales: true, modules: true, createdAt: true, assureSanteId: true };

// Délégation d'accès famille (2026-08) — voir demande utilisateur :
// "l'assuré principal... doit pouvoir donner des droits à un des membres de
// la famille en décidant ce que ce dernier doit pouvoir voir". Cloisonné à
// la famille de l'appelant (vérifié par le contrôleur : le compte connecté
// doit être l'assuré principal racine — familleId null — jamais un ayant
// droit délégué), même principe anti-élévation de privilège que
// PortailClientUtilisateursService (jamais plus de rubriques que l'assuré
// principal n'en détient lui-même).
@Injectable()
export class DelegationsFamilleService {
  constructor(private prisma: PrismaService) {}

  async lister(assureSanteId: string) {
    const membres = await this.prisma.assureSante.findMany({
      where: { familleId: assureSanteId },
      include: { compteUtilisateur: { select: SELECT_SANS_HASH } },
      orderBy: { dateNaissance: "asc" },
    });
    return membres.map((m) => ({
      id: m.id, nom: m.nom, prenom: m.prenom, typeAssure: m.typeAssure, matricule: m.matricule,
      telephone: m.telephone, email: m.email, compte: m.compteUtilisateur,
    }));
  }

  modulesDisponibles(mesModules: string[]) {
    return MODULES_DELEGABLES.filter((m) => mesModules.includes(m));
  }

  private validerModules(modules: string[], modulesDetenus: string[]) {
    const inconnu = modules.find((m) => !MODULES_DELEGABLES.includes(m));
    if (inconnu) throw new BadRequestException(`Rubrique "${inconnu}" inconnue.`);
    const nonDetenu = modules.find((m) => !modulesDetenus.includes(m));
    if (nonDetenu) throw new ForbiddenException(`Vous ne pouvez pas accorder la rubrique "${nonDetenu}" : vous n'y avez pas accès vous-même.`);
  }

  private async trouverMembreDeLaFamille(assureSanteId: string, cibleId: string) {
    const cible = await this.prisma.assureSante.findUnique({ where: { id: cibleId } });
    if (!cible || cible.familleId !== assureSanteId) throw new NotFoundException(`Ayant droit ${cibleId} introuvable dans votre famille.`);
    return cible;
  }

  async accorder(assureSanteId: string, mesModules: string[], cibleId: string, dto: GrantDelegationDto) {
    const cible = await this.trouverMembreDeLaFamille(assureSanteId, cibleId);
    this.validerModules(dto.modules, mesModules);
    const modules = dto.modules.includes("membreDashboard") ? dto.modules : ["membreDashboard", ...dto.modules];

    // Résolution du canal de connexion choisi (2026-08) — voir demande
    // utilisateur. Le matricule existe déjà (unique par contrat, une valeur
    // par personne — rien à faire ici). Email/téléphone sont écrits sur LA
    // FICHE DE L'AYANT DROIT lui-même, jamais sur celle de l'assuré
    // principal.
    if (dto.identifiantType === "email") {
      if (!dto.identifiantValeur?.trim()) throw new BadRequestException("Adresse email requise pour ce canal.");
      await this.prisma.assureSante.update({ where: { id: cibleId }, data: { email: dto.identifiantValeur.trim() } });
    } else if (dto.identifiantType === "telephone") {
      const tel = dto.identifiantValeur?.trim();
      if (!tel) throw new BadRequestException("Numéro de téléphone requis pour ce canal.");
      const principal = await this.prisma.assureSante.findUnique({ where: { id: assureSanteId } });
      // "le numéro de téléphone de l'assuré n'ouvrira que le compte de
      // l'assuré" (voir demande utilisateur) — un ayant droit délégué par
      // téléphone doit donc avoir un numéro DISTINCT de celui de l'assuré
      // principal, sans quoi la connexion par téléphone resterait ambiguë
      // entre les deux comptes (voir AuthService.login).
      if (principal?.telephone && principal.telephone === tel) {
        throw new BadRequestException("Ce numéro est celui de l'assuré principal — l'ayant droit doit avoir son propre numéro pour se connecter par téléphone.");
      }
      await this.prisma.assureSante.update({ where: { id: cibleId }, data: { telephone: tel } });
    }

    const passwordHash = await bcrypt.hash(dto.motDePasse, 10);
    const emailInterne = `${cible.matricule}-${cible.id.slice(-6)}@assure.medassur.local`;
    const initiales = `${cible.nom[0] ?? ""}${cible.prenom?.[0] ?? ""}`.toUpperCase();

    try {
      return await this.prisma.user.upsert({
        where: { assureSanteId: cibleId },
        create: {
          nom: `${cible.nom} ${cible.prenom ?? ""}`.trim(), email: emailInterne, initiales,
          roleId: "assure_principal", passwordHash, modules, assureSanteId: cibleId,
          doitChangerMotDePasse: true,
        },
        update: { passwordHash, modules, doitChangerMotDePasse: true },
        select: SELECT_SANS_HASH,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException("Cette adresse email est déjà utilisée par un autre compte.");
      }
      throw err;
    }
  }

  async modifierModules(assureSanteId: string, mesModules: string[], cibleId: string, modules: string[]) {
    await this.trouverMembreDeLaFamille(assureSanteId, cibleId);
    this.validerModules(modules, mesModules);
    const modulesFinal = modules.includes("membreDashboard") ? modules : ["membreDashboard", ...modules];
    const compte = await this.prisma.user.findUnique({ where: { assureSanteId: cibleId } });
    if (!compte) throw new NotFoundException("Cet ayant droit n'a pas encore de compte — utilisez d'abord « Donner accès ».");
    return this.prisma.user.update({ where: { id: compte.id }, data: { modules: modulesFinal }, select: SELECT_SANS_HASH });
  }

  async revoquer(assureSanteId: string, cibleId: string) {
    await this.trouverMembreDeLaFamille(assureSanteId, cibleId);
    await this.prisma.user.deleteMany({ where: { assureSanteId: cibleId } });
    return { id: cibleId };
  }
}

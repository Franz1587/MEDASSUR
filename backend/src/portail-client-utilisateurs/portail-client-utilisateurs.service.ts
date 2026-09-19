import * as bcrypt from "bcryptjs";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { CreatePortailUtilisateurDto } from "./dto/create-portail-utilisateur.dto";

// Rubriques accordables à un utilisateur du portail — jamais une vue
// interne (voir demande utilisateur : "donner des droits aux utilisateurs
// sur les rubriques du menu" [du portail]). client_entreprise et
// client_particulier partagent exactement le même ensemble de rubriques
// portail (voir role-modules.ts) — l'un ou l'autre fait référence.
const MODULES_PORTAIL_AUTORISES = ROLE_MODULES.client_entreprise;

const SELECT_SANS_HASH = {
  id: true, roleId: true, nom: true, email: true, initiales: true, modules: true, createdAt: true,
  telephone: true, adresse: true, photo: true, clientId: true,
};

// Gestion des utilisateurs du portail client, PAR le client lui-même
// (2026-08) — voir demande utilisateur : "une fonctionnalité permettant de
// créer d'autres utilisateurs et de leur donner des droits sur les
// rubriques du menu... elle servira surtout à l'admin côté client".
// Distincte de UsersService (interne, réservé administrateur/direction
// générale) : ici, cloisonnée au Client du créateur, jamais de rôle
// interne assignable, et un utilisateur ne peut jamais accorder plus de
// droits qu'il n'en détient lui-même (anti-élévation de privilège).
@Injectable()
export class PortailClientUtilisateursService {
  constructor(private prisma: PrismaService) {}

  findAllPourClient(clientId: string) {
    return this.prisma.user.findMany({ where: { clientId }, select: SELECT_SANS_HASH, orderBy: { nom: "asc" } });
  }

  private validerModulesAccordables(modules: string[], modulesDuCreateur: string[]) {
    const inconnu = modules.find((m) => !MODULES_PORTAIL_AUTORISES.includes(m));
    if (inconnu) throw new BadRequestException(`Rubrique "${inconnu}" inconnue.`);
    const nonDetenu = modules.find((m) => !modulesDuCreateur.includes(m));
    if (nonDetenu) throw new ForbiddenException(`Vous ne pouvez pas accorder la rubrique "${nonDetenu}" : vous n'y avez pas accès vous-même.`);
  }

  async create(clientId: string, createurId: string, createurRoleId: string, dto: CreatePortailUtilisateurDto) {
    const createur = await this.prisma.user.findUnique({ where: { id: createurId }, select: { modules: true } });
    this.validerModulesAccordables(dto.modules, createur?.modules ?? []);
    // Toujours accessible — sert de page d'accueil après connexion (même
    // principe que le garde-fou "dashboard" de UsersService.updateModules).
    const modules = dto.modules.includes("portailDashboard") ? dto.modules : ["portailDashboard", ...dto.modules];

    const passwordHash = await bcrypt.hash(dto.motDePasse, 10);
    try {
      return await this.prisma.user.create({
        data: {
          nom: dto.nom, email: dto.email, initiales: dto.initiales, roleId: createurRoleId,
          passwordHash, modules, telephone: dto.telephone, adresse: dto.adresse, clientId,
          doitChangerMotDePasse: true,
        },
        select: SELECT_SANS_HASH,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException(`L'email "${dto.email}" est déjà utilisé par un autre utilisateur.`);
      }
      throw err;
    }
  }

  private async trouverUtilisateurDuClient(clientId: string, id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: SELECT_SANS_HASH });
    if (!u || u.clientId !== clientId) throw new NotFoundException(`Utilisateur ${id} introuvable`);
    return u;
  }

  async updateModules(clientId: string, createurId: string, id: string, modules: string[]) {
    await this.trouverUtilisateurDuClient(clientId, id);
    const createur = await this.prisma.user.findUnique({ where: { id: createurId }, select: { modules: true } });
    this.validerModulesAccordables(modules, createur?.modules ?? []);
    const modulesFinal = modules.includes("portailDashboard") ? modules : ["portailDashboard", ...modules];
    return this.prisma.user.update({ where: { id }, data: { modules: modulesFinal }, select: SELECT_SANS_HASH });
  }

  async remove(clientId: string, createurId: string, id: string) {
    if (id === createurId) throw new ForbiddenException("Vous ne pouvez pas supprimer votre propre compte.");
    await this.trouverUtilisateurDuClient(clientId, id);
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }
}

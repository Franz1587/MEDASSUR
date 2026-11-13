import * as bcrypt from "bcryptjs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { UpdateUserDto } from "../users/dto/update-user.dto";
import { UpdateModulesDto } from "../users/dto/update-modules.dto";
import { MessagingService } from "../messaging/messaging.service";

const MOT_DE_PASSE_INITIAL = "medassur2024";

const SELECT_SANS_HASH = {
  id: true, roleId: true, nom: true, email: true, initiales: true, modules: true, createdAt: true,
  telephone: true, adresse: true, photo: true, derniereConnexion: true,
};

// Gestion des utilisateurs PAR société, pour le Super Admin (2026-09) —
// voir demande utilisateur : "il doit pouvoir créer et gérer des
// utilisateurs pour chaque société et affecter [des droits]." Distinct de
// UsersService (qui opère TOUJOURS sur la société de l'acteur connecté, via
// TenantContext) : ici le Super Admin choisit explicitement la société
// cible en paramètre — son propre contexte n'en a aucune (societeId null,
// voir TenantContext). Même plafonnement par abonnement que UsersService.
// plafonnerModules, mais dérivé du paramètre `societeId` plutôt que du
// contexte de requête.
@Injectable()
export class SocieteUsersService {
  constructor(private prisma: PrismaService, private messaging: MessagingService) {}

  // Message d'accès envoyé par SMS/WhatsApp (2026-09) — voir demande
  // utilisateur : "je ne reçois toujours pas de sms... pour le compte de
  // la ruche excellence le courtier et la société".
  private construireMessageAcces(email: string, motDePasse: string): string {
    return `Vos accès MedAssur\nIdentifiant : ${email}\nMot de passe temporaire : ${motDePasse}\nCe mot de passe vous sera demandé de changer dès la première connexion.`;
  }

  private async societe(societeId: string) {
    const s = await this.prisma.societeAssurance.findUnique({ where: { id: societeId }, select: { id: true, nom: true, modules: true } });
    if (!s) throw new NotFoundException(`Société ${societeId} introuvable`);
    return s;
  }

  private plafonner(modules: string[], modulesAutorises: string[]): string[] {
    const autorises = new Set(modulesAutorises);
    return modules.filter((m) => m === "dashboard" || autorises.has(m));
  }

  findAll(societeId: string) {
    return this.prisma.user.findMany({ where: { societeId }, select: SELECT_SANS_HASH, orderBy: { nom: "asc" } });
  }

  private async findOneDansSociete(societeId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, societeId }, select: SELECT_SANS_HASH });
    if (!u) throw new NotFoundException(`Utilisateur ${userId} introuvable dans cette société`);
    return u;
  }

  async create(societeId: string, dto: CreateUserDto) {
    const societe = await this.societe(societeId);
    const passwordHash = await bcrypt.hash(MOT_DE_PASSE_INITIAL, 10);
    const modulesDemandes = dto.modules
      ?? (await this.prisma.roleModuleTemplate.findUnique({ where: { roleId: dto.roleId } }))?.modules
      ?? ROLE_MODULES[dto.roleId as keyof typeof ROLE_MODULES] ?? [];
    const modules = this.plafonner(modulesDemandes, societe.modules);
    try {
      const cree = await this.prisma.user.create({
        data: { nom: dto.nom, email: dto.email, initiales: dto.initiales, roleId: dto.roleId, passwordHash, modules, telephone: dto.telephone, adresse: dto.adresse, societeId, doitChangerMotDePasse: true },
        select: SELECT_SANS_HASH,
      });
      // Envoi réel des identifiants (2026-09) — voir demande utilisateur :
      // "je ne reçois toujours pas de sms... pour le compte de la ruche
      // excellence le courtier et la société". Best-effort, jamais
      // bloquant pour la création elle-même.
      if (this.messaging.numeroValide(dto.telephone)) {
        this.messaging.envoyer(dto.telephone, this.construireMessageAcces(dto.email, MOT_DE_PASSE_INITIAL)).catch(() => undefined);
      }
      return cree;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`L'email "${dto.email}" est déjà utilisé par un autre utilisateur.`);
      }
      throw err;
    }
  }

  async update(societeId: string, userId: string, dto: UpdateUserDto) {
    await this.findOneDansSociete(societeId, userId);
    try {
      return await this.prisma.user.update({ where: { id: userId }, data: dto, select: SELECT_SANS_HASH });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`L'email "${dto.email}" est déjà utilisé par un autre utilisateur.`);
      }
      throw err;
    }
  }

  async updateModules(societeId: string, userId: string, dto: UpdateModulesDto) {
    await this.findOneDansSociete(societeId, userId);
    if (!dto.modules.includes("dashboard")) {
      throw new BadRequestException("Le tableau de bord ne peut pas être retiré — il sert de page d'accueil après connexion.");
    }
    const societe = await this.societe(societeId);
    const modules = this.plafonner(dto.modules, societe.modules);
    return this.prisma.user.update({ where: { id: userId }, data: { modules }, select: SELECT_SANS_HASH });
  }

  // Support (2026-09) — le Super Admin réinitialise le mot de passe d'un
  // utilisateur bloqué, sans flux d'email (aucun fournisseur branché, même
  // limite que partout ailleurs dans l'application).
  async reinitialiserMotDePasse(societeId: string, userId: string) {
    const utilisateur = await this.findOneDansSociete(societeId, userId);
    const passwordHash = await bcrypt.hash(MOT_DE_PASSE_INITIAL, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, doitChangerMotDePasse: true } });
    // Envoi réel (2026-09) — voir demande utilisateur ci-dessus.
    const smsEnvoye = this.messaging.numeroValide(utilisateur.telephone);
    if (smsEnvoye) {
      await this.messaging.envoyer(utilisateur.telephone, this.construireMessageAcces(utilisateur.email, MOT_DE_PASSE_INITIAL));
    }
    return { motDePasse: MOT_DE_PASSE_INITIAL, smsEnvoye };
  }

  async remove(societeId: string, userId: string) {
    const utilisateurs = await this.findAll(societeId);
    if (utilisateurs.length <= 1) {
      throw new BadRequestException("Impossible de supprimer le dernier compte de cette société — elle resterait sans aucun accès.");
    }
    await this.findOneDansSociete(societeId, userId);
    await this.prisma.user.delete({ where: { id: userId } });
    return { id: userId };
  }
}

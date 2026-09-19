import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_MODULES } from "../auth/role-modules";
import { TenantContext } from "../tenant/tenant-context";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateModulesDto } from "./dto/update-modules.dto";

// Mot de passe initial des comptes créés depuis l'admin — même convention
// que le seed de démo (voir prisma/seed.ts DEMO_PASSWORD) ; pas de flux de
// réinitialisation/envoi d'email dans cette version.
const MOT_DE_PASSE_INITIAL = "medassur2024";

// Photo de profil (2026-08) — même principe que AssureSante.photo (voir
// SanteService.uploadPhoto/deletePhoto), dossier dédié pour ne pas mélanger
// avec les photos des assurés.
const UPLOADS_PHOTOS_DIR = path.join(UPLOADS_ROOT, "photos-users");
// Signature électronique (2026-09) — même principe que photos-users.
const UPLOADS_SIGNATURES_DIR = path.join(UPLOADS_ROOT, "signatures");

const SELECT_SANS_HASH = {
  id: true, roleId: true, nom: true, email: true, initiales: true, modules: true, createdAt: true,
  telephone: true, adresse: true, photo: true, signature: true,
  // societeId/societe (2026-09) — voir demande utilisateur : "une gestion
  // des utilisateurs" côté Super Admin, qui n'a lui-même aucune société
  // (TenantContext null) et doit donc voir à laquelle chaque compte
  // appartient. Sans effet pour l'écran interne (administrateur d'une
  // société ne voit de toute façon que ses propres comptes, tous dans SA
  // société — champ juste ignoré côté frontend pour ce rôle).
  societeId: true,
  societe: { select: { nom: true } },
  // Agence de rattachement (2026-09) — voir demande utilisateur : "lier un
  // agent de saisie à une agence... afin que ce soit cette agence qui
  // remonte sur le décompte".
  agenceId: true,
  agence: { select: { id: true, nom: true } },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  findAll() {
    return this.prisma.user.findMany({ select: SELECT_SANS_HASH, orderBy: { nom: "asc" } });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: SELECT_SANS_HASH });
    if (!u) throw new NotFoundException(`Utilisateur ${id} introuvable`);
    return u;
  }

  // Plafonne les modules qu'un ADMINISTRATEUR DE SOCIÉTÉ peut accorder à ses
  // propres utilisateurs, à la hauteur de l'abonnement souscrit par SA
  // société (2026-09) — voir demande utilisateur : "il revient au super
  // Admin de donner accès à ces modules là en fonction du type
  // d'abonnement souscrit" ; un administrateur ne peut jamais accorder à un
  // collaborateur un module que sa propre société n'a pas. `dashboard`
  // reste toujours autorisé (page d'accueil obligatoire, voir
  // updateModules ci-dessous). Sans société dans le contexte (super_admin,
  // scripts) — aucune limite, comportement historique préservé.
  private async plafonnerModules(modules: string[]): Promise<string[]> {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) return modules;
    const societe = await this.prisma.societeAssurance.findUnique({ where: { id: societeId }, select: { modules: true } });
    if (!societe) return modules;
    const autorises = new Set(societe.modules);
    return modules.filter((m) => m === "dashboard" || autorises.has(m));
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(MOT_DE_PASSE_INITIAL, 10);
    // Modèle générique par rôle (voir RoleTemplatesService) — éditable
    // depuis Administration → "Rôles", donc lu en base plutôt que depuis la
    // constante ROLE_MODULES codée en dur ; repli sur celle-ci si la ligne
    // manque encore (rôle ajouté au code après le dernier seed).
    const modulesDemandes = dto.modules
      ?? (await this.prisma.roleModuleTemplate.findUnique({ where: { roleId: dto.roleId } }))?.modules
      ?? ROLE_MODULES[dto.roleId as keyof typeof ROLE_MODULES] ?? [];
    const modules = await this.plafonnerModules(modulesDemandes);
    try {
      return await this.prisma.user.create({
        data: { nom: dto.nom, email: dto.email, initiales: dto.initiales, roleId: dto.roleId, passwordHash, modules, telephone: dto.telephone, adresse: dto.adresse, agenceId: dto.agenceId, doitChangerMotDePasse: true },
        select: SELECT_SANS_HASH,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`L'email "${dto.email}" est déjà utilisé par un autre utilisateur.`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    // agenceId: chaîne vide envoyée par le sélecteur "Aucune agence" (voir
    // Combobox allowClear côté frontend) — jamais transmise telle quelle à
    // Prisma (FK vers un id "" inexistant), convertie en null pour retirer
    // l'agence.
    const data = { ...dto, agenceId: dto.agenceId === "" ? null : dto.agenceId };
    try {
      return await this.prisma.user.update({ where: { id }, data, select: SELECT_SANS_HASH });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException(`L'email "${dto.email}" est déjà utilisé par un autre utilisateur.`);
      }
      throw err;
    }
  }

  async updateModules(id: string, dto: UpdateModulesDto) {
    const utilisateur = await this.findOne(id);
    // Page d'accueil par rôle (2026-09) — comblé après coup : cette garde ne
    // vérifiait QUE la clé "dashboard" (interne), jamais la variante propre
    // à chaque famille de rôle (superAdminDashboard, portailDashboard,
    // membreDashboard, prestataireDashboard, medecinDashboard — toujours
    // premier élément de ROLE_MODULES[roleId], voir role-modules.ts). Un
    // Super Admin (ou tout compte externe) n'a jamais "dashboard" dans ses
    // modules → la sauvegarde échouait TOUJOURS à 400 pour ces rôles, même
    // sans aucun changement de droits (voir demande utilisateur, capture :
    // "PATCH .../modules failed (400)... Le tableau de bord ne peut pas
    // être retiré" sur un compte Super Admin).
    const accueil = ROLE_MODULES[utilisateur.roleId as keyof typeof ROLE_MODULES]?.[0] ?? "dashboard";
    if (!dto.modules.includes(accueil)) {
      throw new BadRequestException("Le tableau de bord ne peut pas être retiré — il sert de page d'accueil après connexion.");
    }
    const modules = await this.plafonnerModules(dto.modules);
    return this.prisma.user.update({ where: { id }, data: { modules }, select: SELECT_SANS_HASH });
  }

  // Changement de mot de passe en libre-service (2026-09) — voir demande
  // utilisateur : "un vrai formulaire Mon profil... c'est là qu'il pourra
  // changer de mot de passe". Exige l'ancien (bcrypt.compare, même patron
  // que AuthService.login) avant d'accepter le nouveau — jamais un simple
  // remplacement sans preuve de connaître le mot de passe actuel.
  async changerMotDePasse(id: string, dto: { ancienMotDePasse: string; nouveauMotDePasse: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Utilisateur ${id} introuvable`);
    if (!(await bcrypt.compare(dto.ancienMotDePasse, user.passwordHash))) {
      throw new BadRequestException("Mot de passe actuel incorrect.");
    }
    const passwordHash = await bcrypt.hash(dto.nouveauMotDePasse, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, doitChangerMotDePasse: false } });
    return { ok: true };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }

  async uploadPhoto(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".jpg";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("photos-users", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_PHOTOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_PHOTOS_DIR, filename), file.buffer);
    }
    return this.prisma.user.update({ where: { id }, data: { photo: filename }, select: SELECT_SANS_HASH });
  }

  async deletePhoto(id: string) {
    const u = await this.findOne(id);
    if (u.photo) {
      if (this.storage.actif) await this.storage.delete("photos-users", u.photo);
      else await fs.promises.unlink(path.join(UPLOADS_PHOTOS_DIR, u.photo)).catch(() => undefined);
    }
    return this.prisma.user.update({ where: { id }, data: { photo: null }, select: SELECT_SANS_HASH });
  }

  // Signature électronique — upload direct (2026-09) — voir demande
  // utilisateur : "il pourra charger un fichier de sa signature en image
  // peu importe le format". Même principe que uploadPhoto, dossier dédié.
  async uploadSignature(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("signatures", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_SIGNATURES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_SIGNATURES_DIR, filename), file.buffer);
    }
    return this.prisma.user.update({ where: { id }, data: { signature: filename }, select: SELECT_SANS_HASH });
  }

  async deleteSignature(id: string) {
    const u = await this.findOne(id);
    if (u.signature) {
      if (this.storage.actif) await this.storage.delete("signatures", u.signature);
      else await fs.promises.unlink(path.join(UPLOADS_SIGNATURES_DIR, u.signature)).catch(() => undefined);
    }
    return this.prisma.user.update({ where: { id }, data: { signature: null }, select: SELECT_SANS_HASH });
  }

  // Signature électronique — capture par QR code (2026-09) — voir demande
  // utilisateur : "l'application devra générer un QR code qui sera
  // scanné... une fois scanné, en cliquant sur le lien le téléphone ou la
  // tablette nous ouvre une page de signature, on signe et on valide, la
  // signature se charge dans le compte de l'utilisateur." Jeton à usage
  // unique, courte durée de vie (10 min) — le téléphone qui scanne n'est
  // JAMAIS authentifié lui-même, seul le jeton (connu uniquement de
  // l'écran qui a généré le QR) prouve quel compte signer.
  async genererJetonSignature(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.signatureToken.create({ data: { token, userId, expiresAt } });
    return { token, expiresAt };
  }

  private async jetonValide(token: string) {
    const jeton = await this.prisma.signatureToken.findUnique({ where: { token }, include: { user: { select: { nom: true } } } });
    if (!jeton) throw new NotFoundException("Lien de signature invalide.");
    if (jeton.usedAt) throw new BadRequestException("Cette signature a déjà été enregistrée.");
    if (jeton.expiresAt < new Date()) throw new BadRequestException("Ce lien de signature a expiré — régénérez un nouveau QR code.");
    return jeton;
  }

  async statutJetonSignature(token: string): Promise<{ signe: boolean }> {
    const jeton = await this.prisma.signatureToken.findUnique({ where: { token }, select: { usedAt: true } });
    return { signe: !!jeton?.usedAt };
  }

  // Appelée par la page PUBLIQUE de signature (voir SignatureController) —
  // affiche juste "Signature pour : <nom>" avant que la personne ne signe,
  // sans exposer quoi que ce soit d'autre du compte.
  async infoJetonSignature(token: string): Promise<{ nom: string }> {
    const jeton = await this.jetonValide(token);
    return { nom: jeton.user.nom };
  }

  // buffer = le tracé signé, exporté en PNG depuis le canvas du téléphone
  // (voir SignaturePage.tsx côté frontend).
  async signerAvecJeton(token: string, buffer: Buffer): Promise<void> {
    const jeton = await this.jetonValide(token);
    const filename = `${jeton.userId}.png`;
    if (this.storage.actif) {
      await this.storage.upload("signatures", filename, buffer, "image/png");
    } else {
      await fs.promises.mkdir(UPLOADS_SIGNATURES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_SIGNATURES_DIR, filename), buffer);
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: jeton.userId }, data: { signature: filename } }),
      this.prisma.signatureToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);
  }
}

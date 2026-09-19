import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { CreateModeleCarteDto, UpdateModeleCarteDto } from "./dto/modele-carte.dto";

const UPLOADS_MODELES_CARTE_DIR = path.join(UPLOADS_ROOT, "modeles-carte");
const CAT_MODELES_CARTE = "modeles-carte";
const ID_CLASSIQUE = "classique";

// Catalogue des modèles de carte importables (2026-09) — voir demande
// utilisateur : "on peut importer les modèles et l'application place le
// modèle comme choix pour chaque société." Catalogue PARTAGÉ, géré
// exclusivement par le Super Admin (comme PlanAbonnement/
// RubriqueFacturation) — chaque société choisit ensuite parmi ce catalogue
// via ParametresEntreprise.modeleCarteId. Voir DocumentsService.
// ajouterCarteRectoVerso pour l'utilisation réelle (fond plein cadre +
// champs dynamiques superposés aux mêmes positions qu'aujourd'hui).
@Injectable()
export class ModelesCarteService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private async supprimerFichier(filename: string) {
    if (this.storage.actif) await this.storage.delete(CAT_MODELES_CARTE, filename);
    else await fs.promises.unlink(path.join(UPLOADS_MODELES_CARTE_DIR, filename)).catch(() => undefined);
  }

  findAll() {
    return this.prisma.modeleCarte.findMany({ orderBy: [{ id: "asc" }, { createdAt: "asc" }] });
  }

  async findOne(id: string) {
    const m = await this.prisma.modeleCarte.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Modèle de carte ${id} introuvable`);
    return m;
  }

  create(dto: CreateModeleCarteDto) {
    return this.prisma.modeleCarte.create({ data: dto });
  }

  async update(id: string, dto: UpdateModeleCarteDto) {
    await this.findOne(id);
    return this.prisma.modeleCarte.update({ where: { id }, data: dto });
  }

  // "classique" (dessin généré, aucune image) reste toujours disponible —
  // c'est le repli historique pour toute société qui n'a rien choisi.
  // Une société l'utilisant activement n'empêche PAS sa suppression pour
  // les autres (elle n'a rien à supprimer côté fichier), contrairement à
  // un modèle importé.
  async remove(id: string) {
    if (id === ID_CLASSIQUE) throw new BadRequestException("Le modèle « Classique » ne peut pas être supprimé — c'est le repli par défaut.");
    const m = await this.findOne(id);
    const utilise = await this.prisma.parametresEntreprise.count({ where: { modeleCarteId: id } });
    if (utilise > 0) {
      throw new BadRequestException(`Impossible de supprimer « ${m.nom} » — ${utilise} société(s) l'utilisent déjà. Désactivez-le plutôt (case « actif »).`);
    }
    for (const filename of [m.imageRecto, m.imageVerso]) {
      if (filename) await this.supprimerFichier(filename);
    }
    await this.prisma.modeleCarte.delete({ where: { id } });
    return { id };
  }

  async uploadImage(id: string, face: "recto" | "verso", file: Express.Multer.File) {
    const m = await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}-${face}-${randomUUID().slice(0, 6)}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload(CAT_MODELES_CARTE, filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_MODELES_CARTE_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_MODELES_CARTE_DIR, filename), file.buffer);
    }
    const ancien = face === "recto" ? m.imageRecto : m.imageVerso;
    if (ancien) await this.supprimerFichier(ancien);
    await this.prisma.modeleCarte.update({ where: { id }, data: face === "recto" ? { imageRecto: filename } : { imageVerso: filename } });
    return this.findOne(id);
  }

  async deleteImage(id: string, face: "recto" | "verso") {
    const m = await this.findOne(id);
    const filename = face === "recto" ? m.imageRecto : m.imageVerso;
    if (filename) await this.supprimerFichier(filename);
    await this.prisma.modeleCarte.update({ where: { id }, data: face === "recto" ? { imageRecto: null } : { imageVerso: null } });
    return this.findOne(id);
  }
}

import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { CreateRegleConsigneDto } from "./dto/create-regle-consigne.dto";
import { UpdateRegleConsigneDto } from "./dto/update-regle-consigne.dto";

const UPLOADS_REGLES_DIR = path.join(UPLOADS_ROOT, "regles-consignes");

// Règles & Consignes (2026-08) — voir demande utilisateur : liste globale
// (pas de rattachement Client/Contrat) mise en place côté assurance, lue
// en lecture seule côté portail client (voir PortailClientController).
@Injectable()
export class ReglesConsignesService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private async supprimerFichier(filename: string) {
    if (this.storage.actif) await this.storage.delete("regles-consignes", filename);
    else await fs.promises.unlink(path.join(UPLOADS_REGLES_DIR, filename)).catch(() => undefined);
  }

  findAll(actifSeulement = false) {
    return this.prisma.regleConsigne.findMany({
      where: actifSeulement ? { actif: true } : undefined,
      orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.regleConsigne.findUnique({ where: { id } });
    if (!r) throw new NotFoundException(`Règle/consigne ${id} introuvable`);
    return r;
  }

  create(dto: CreateRegleConsigneDto) {
    return this.prisma.regleConsigne.create({ data: dto });
  }

  async update(id: string, dto: UpdateRegleConsigneDto) {
    await this.findOne(id);
    return this.prisma.regleConsigne.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    const r = await this.prisma.regleConsigne.findUnique({ where: { id } });
    if (r?.fichier) await this.supprimerFichier(r.fichier);
    await this.prisma.regleConsigne.delete({ where: { id } });
    return { id };
  }

  // Document joint (2026-08) — même principe qu'AccordPrealableService.
  // uploadDocument : le fichier écrit sur disque, seul le nom stocké en
  // base. Servi statiquement sous /uploads (voir main.ts), donc directement
  // téléchargeable par le portail client sans endpoint dédié.
  async uploadDocument(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || "";
    const filename = `${id}-${randomUUID().slice(0, 6)}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("regles-consignes", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_REGLES_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_REGLES_DIR, filename), file.buffer);
    }
    return this.prisma.regleConsigne.update({ where: { id }, data: { fichier: filename } });
  }

  async deleteDocument(id: string) {
    const r = await this.findOne(id);
    if (r.fichier) await this.supprimerFichier(r.fichier);
    return this.prisma.regleConsigne.update({ where: { id }, data: { fichier: null } });
  }
}

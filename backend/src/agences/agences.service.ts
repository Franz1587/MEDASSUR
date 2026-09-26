import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAgenceDto } from "./dto/create-agence.dto";
import { cleMention } from "./agence-mention.util";

// Agence (2026-09) — voir schema.prisma Agence pour le détail de la demande
// utilisateur. Référentiel cloisonné par société via le middleware Prisma,
// entièrement paramétré depuis l'écran Agences (coordonnées, statut,
// mentions reconnues à l'import) — jamais de correspondance codée en dur.
@Injectable()
export class AgencesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.agence.findMany({
      orderBy: { nom: "asc" },
      include: { _count: { select: { contrats: true, agents: true } } },
    });
  }

  async findOne(id: string) {
    const agence = await this.prisma.agence.findUnique({ where: { id } });
    if (!agence) throw new NotFoundException(`Agence ${id} introuvable`);
    return agence;
  }

  async create(dto: CreateAgenceDto) {
    const data = await this.preparer(dto);
    return this.prisma.agence.create({ data: { id: randomUUID(), ...data, nom: dto.nom.trim() } as Prisma.AgenceUncheckedCreateInput });
  }

  async update(id: string, dto: Partial<CreateAgenceDto>) {
    await this.findOne(id);
    const data = await this.preparer(dto, id);
    return this.prisma.agence.update({ where: { id }, data: data as Prisma.AgenceUncheckedUpdateInput });
  }

  // Champs texte vides → null (un champ effacé dans le formulaire doit
  // vraiment se vider), mentions normalisées/dédoublonnées, et refus
  // qu'une même mention désigne deux agences : l'import ne saurait plus
  // laquelle choisir.
  private async preparer(dto: Partial<CreateAgenceDto>, idCourant?: string) {
    const { mentionsImport, ...reste } = dto;
    const data: Record<string, unknown> = {};
    for (const [cle, valeur] of Object.entries(reste)) {
      data[cle] = typeof valeur === "string" ? valeur.trim() || null : valeur;
    }
    if (data.nom === null) throw new BadRequestException("Le nom de l'agence est obligatoire.");
    if (mentionsImport) {
      // Dédoublonnage insensible à la casse/aux accents ("POG" = "pog").
      const mentions: string[] = [];
      for (const m of mentionsImport.map((x) => x.trim()).filter(Boolean)) {
        if (!mentions.some((x) => cleMention(x) === cleMention(m))) mentions.push(m);
      }
      const autres = await this.prisma.agence.findMany({ where: idCourant ? { id: { not: idCourant } } : {}, select: { nom: true, mentionsImport: true } });
      for (const m of mentions) {
        const conflit = autres.find((a) => a.mentionsImport.some((x) => cleMention(x) === cleMention(m)));
        if (conflit) throw new BadRequestException(`La mention "${m}" est déjà utilisée par l'agence "${conflit.nom}".`);
      }
      data.mentionsImport = mentions;
    }
    return data;
  }

  // Suppression refusée tant que des agents OU des contrats y sont
  // rattachés — jamais de rattachement perdu en silence.
  async remove(id: string) {
    await this.findOne(id);
    const [nbAgents, nbContrats] = await Promise.all([
      this.prisma.user.count({ where: { agenceId: id } }),
      this.prisma.contrat.count({ where: { agenceId: id } }),
    ]);
    if (nbAgents > 0 || nbContrats > 0) {
      const parts = [nbAgents > 0 ? `${nbAgents} agent(s)` : null, nbContrats > 0 ? `${nbContrats} contrat(s)` : null].filter(Boolean).join(" et ");
      throw new BadRequestException(`${parts} sont encore rattachés à cette agence — réaffectez-les ou passez l'agence en "Inactif" plutôt que de la supprimer.`);
    }
    await this.prisma.agence.delete({ where: { id } });
    return { id };
  }
}

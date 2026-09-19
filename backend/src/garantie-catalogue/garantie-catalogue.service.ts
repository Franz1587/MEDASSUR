import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGarantieCatalogueDto } from "./dto/create-garantie-catalogue.dto";

// Catalogue à double nature (2026-09) — voir schema.prisma : compagnieId
// null = suggestion générique PARTAGÉE entre toutes les sociétés (comme
// ActeMedical/CodeAffection, jamais cloisonnée — volontairement absente de
// TENANT_MODELS) ; compagnieId renseigné = tableau de garanties propre à
// UNE compagnie, donc à UNE société (Compagnie EST cloisonnée). Comblé
// après coup (2026-09) : findAll() remontait TOUTES les lignes
// compagnie-owned de TOUTES les sociétés sans filtrage. Corrigé À LA MAIN
// ici plutôt que via TENANT_MODELS, qui appliquerait un filtre societeId
// strict et ferait disparaître les lignes génériques partagées (qui n'ont
// justement pas de societeId) pour tout le monde.
@Injectable()
export class GarantieCatalogueService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Compagnie est cloisonnée par le middleware Prisma — cette liste ne
    // contient donc déjà que les compagnies de l'appelant.
    const mesCompagnies = await this.prisma.compagnie.findMany({ select: { id: true } });
    return this.prisma.garantieCatalogue.findMany({
      where: { OR: [{ compagnieId: null }, { compagnieId: { in: mesCompagnies.map((c) => c.id) } }] },
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
    });
  }

  create(dto: CreateGarantieCatalogueDto) {
    // Toujours une ligne générique partagée (compagnieId=null) — les lignes
    // compagnie-owned se créent depuis l'écran Compagnie (voir
    // CompagniesService.replaceGarantiesCatalogue, déjà scopé via
    // findOne(compagnieId)), jamais depuis ce endpoint générique.
    return this.prisma.garantieCatalogue.create({ data: dto });
  }

  async remove(id: string) {
    const item = await this.prisma.garantieCatalogue.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Rubrique de garantie ${id} introuvable`);
    // Ligne compagnie-owned (2026-09) — vérifie que cette compagnie
    // appartient bien à la société de l'appelant avant de la supprimer
    // (Compagnie est cloisonnée, ce findUnique échoue silencieusement pour
    // la compagnie d'une AUTRE société).
    if (item.compagnieId) {
      const compagnie = await this.prisma.compagnie.findUnique({ where: { id: item.compagnieId } });
      if (!compagnie) throw new NotFoundException(`Rubrique de garantie ${id} introuvable`);
    }
    await this.prisma.garantieCatalogue.delete({ where: { id } });
    return { id };
  }
}

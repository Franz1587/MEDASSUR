import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { genererMotDePasseTemporaire, slugifier } from "../shared/mot-de-passe.util";
import { ROLE_MODULES } from "../auth/role-modules";
import { CreateMedecinDto } from "./dto/create-medecin.dto";
import { UpdateMedecinDto } from "./dto/update-medecin.dto";

const INCLUDE_STRUCTURES = { structures: { include: { prestataire: true } } } as const;

// Professionnel de santé (2026-08) — voir demande utilisateur : "il faut à
// présent rendre possible l'ajout d'un médecin et sa spécialité dans le
// prestataire... créer un onglet professionnel de santé [rubrique
// Système]... créer des médecins, puis les lier à une clinique, hôpital...
// car un même médecin peut faire des prestations dans plusieurs structures
// médicales." Medecin est un modèle séparé de Prestataire (qui reste la
// STRUCTURE) — voir schema.prisma pour la relation plusieurs-à-plusieurs
// MedecinPrestataire.
@Injectable()
export class MedecinsService {
  constructor(private prisma: PrismaService) {}

  findAll(filtres?: { q?: string; prestataireId?: string }) {
    return this.prisma.medecin.findMany({
      where: {
        ...(filtres?.q
          ? { OR: [{ nom: { contains: filtres.q, mode: "insensitive" } }, { specialite: { contains: filtres.q, mode: "insensitive" } }, { codePraticien: { contains: filtres.q, mode: "insensitive" } }] }
          : {}),
        ...(filtres?.prestataireId ? { structures: { some: { prestataireId: filtres.prestataireId } } } : {}),
      },
      include: INCLUDE_STRUCTURES,
      orderBy: { nom: "asc" },
    });
  }

  async findOne(id: string) {
    const medecin = await this.prisma.medecin.findUnique({ where: { id }, include: INCLUDE_STRUCTURES });
    if (!medecin) throw new NotFoundException(`Médecin ${id} introuvable`);
    return medecin;
  }

  // Génère prenom.nom@medassur.cloud sans collision (suffixe numérique si pris).
  private async genererEmailMedecin(prenom: string, nom: string): Promise<string> {
    const base = `${slugifier(prenom)}.${slugifier(nom)}`;
    const candidats = [`${base}@medassur.cloud`, ...Array.from({ length: 98 }, (_, i) => `${base}${i + 2}@medassur.cloud`)];
    for (const email of candidats) {
      const pris = await this.prisma.user.findFirst({ where: { email }, select: { id: true } });
      if (!pris) return email;
    }
    return `${base}-${Date.now()}@medassur.cloud`;
  }

  // Crée le compte medassur.cloud (medecin_prescripteur) lié au médecin.
  // Retourne le mot de passe temporaire en clair pour transmission à l'admin.
  private async creerCompteMedecin(medecinId: string, prenom: string, nom: string): Promise<string> {
    const email = await this.genererEmailMedecin(prenom, nom);
    const mdp = genererMotDePasseTemporaire();
    const hash = await bcrypt.hash(mdp, 10);
    const initiales = `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase() || "MD";
    const societeId = TenantContext.getSocieteId() ?? null;
    await this.prisma.user.create({
      data: {
        nom: `${prenom} ${nom}`, email, initiales, passwordHash: hash,
        roleId: "medecin_prescripteur", medecinId,
        modules: ROLE_MODULES["medecin_prescripteur"],
        societeId,
        doitChangerMotDePasse: true,
      },
    });
    return mdp;
  }

  async create(dto: CreateMedecinDto) {
    const { prestataireIds, ...header } = dto;

    // Dédoublonnage : code praticien exact → nom + prénom → création
    let existant = header.codePraticien
      ? await this.prisma.medecin.findFirst({ where: { codePraticien: { equals: header.codePraticien.trim(), mode: "insensitive" } } })
      : null;
    if (!existant && header.nom && header.prenom) {
      existant = await this.prisma.medecin.findFirst({
        where: {
          nom: { equals: header.nom.trim(), mode: "insensitive" },
          prenom: { equals: header.prenom.trim(), mode: "insensitive" },
        },
      });
    }

    if (existant) {
      // Lier les nouvelles structures si elles manquent
      for (const prestataireId of prestataireIds ?? []) {
        await this.prisma.medecinPrestataire.upsert({
          where: { medecinId_prestataireId: { medecinId: existant.id, prestataireId } },
          create: { medecinId: existant.id, prestataireId },
          update: {},
        });
      }
      const medecin = await this.findOne(existant.id);
      return { ...medecin, motDePasseTemporaire: null as string | null, compteExistant: true };
    }

    const medecin = await this.prisma.medecin.create({
      data: {
        ...header,
        structures: prestataireIds?.length ? { create: prestataireIds.map((prestataireId) => ({ prestataireId })) } : undefined,
      },
      include: INCLUDE_STRUCTURES,
    });

    // Compte medassur.cloud automatique dès qu'on a un prénom et un nom
    let motDePasseTemporaire: string | null = null;
    if (medecin.prenom && medecin.nom) {
      motDePasseTemporaire = await this.creerCompteMedecin(medecin.id, medecin.prenom, medecin.nom);
    }

    return { ...medecin, motDePasseTemporaire, compteExistant: false };
  }

  async update(id: string, dto: UpdateMedecinDto) {
    await this.findOne(id);
    return this.prisma.medecin.update({ where: { id }, data: dto, include: INCLUDE_STRUCTURES });
  }

  // Suppression bloquée si le médecin a déjà été désigné bénéficiaire d'un
  // règlement (2026-08) — voir BordereauReglement.medecinId : perdre cette
  // traçabilité comptable romprait l'historique des paiements déjà émis.
  async remove(id: string) {
    await this.findOne(id);
    const nbReglements = await this.prisma.bordereauReglement.count({ where: { medecinId: id } });
    if (nbReglements > 0) {
      throw new BadRequestException(`Ce médecin est référencé par ${nbReglements} règlement(s) — désactivez-le plutôt que de le supprimer.`);
    }
    await this.prisma.medecin.delete({ where: { id } });
  }

  async lierStructure(medecinId: string, prestataireId: string) {
    await this.findOne(medecinId);
    const prestataire = await this.prisma.prestataire.findUnique({ where: { id: prestataireId } });
    if (!prestataire) throw new NotFoundException(`Prestataire ${prestataireId} introuvable`);
    await this.prisma.medecinPrestataire.upsert({
      where: { medecinId_prestataireId: { medecinId, prestataireId } },
      create: { medecinId, prestataireId },
      update: {},
    });
    return this.findOne(medecinId);
  }

  async delierStructure(medecinId: string, prestataireId: string) {
    await this.prisma.medecinPrestataire.deleteMany({ where: { medecinId, prestataireId } });
    return this.findOne(medecinId);
  }
}

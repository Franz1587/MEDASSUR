import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProspectDto } from "./dto/create-prospect.dto";
import { UpdateProspectDto } from "./dto/update-prospect.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { calculerCommissionsProspect, commissionMoyenne } from "./commission.util";

const UPLOADS_LOGOS_DIR = path.join(UPLOADS_ROOT, "logos-prospects");

const INCLUDE_DETAIL = {
  client: { select: { id: true, nom: true } },
  historique: { orderBy: { date: "desc" as const }, include: { auteur: { select: { nom: true } } } },
} as const;

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  findAll() {
    return this.prisma.prospect.findMany({ orderBy: { dernierContact: "desc" }, include: { client: { select: { id: true, nom: true } } } });
  }

  async findOne(id: string) {
    const prospect = await this.prisma.prospect.findUnique({ where: { id }, include: INCLUDE_DETAIL });
    if (!prospect) throw new NotFoundException(`Prospect ${id} introuvable`);
    return prospect;
  }

  async create(dto: CreateProspectDto, gestionnaireId: string) {
    const id = `PRO-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    await this.prisma.prospect.create({ data: { id, ...dto, gestionnaireId } });
    await this.prisma.prospectHistorique.create({
      data: { prospectId: id, auteurId: gestionnaireId, type: "ChangementEtape", etapeApres: dto.etape, description: `Dossier créé — étape "${dto.etape}"` },
    });
    return this.findOne(id);
  }

  // Historique automatique (2026-08) — voir demande utilisateur :
  // "l'application doit permettre de renseigner les informations sur
  // l'évolution d'un dossier de prospection" — un changement d'étape est
  // le signal le plus significatif de cette évolution, journalisé sans
  // action supplémentaire du commercial. Sert aussi de source de vérité
  // pour les statistiques par exercice (voir statistiques ci-dessous) : la
  // date RÉELLE du passage à "Gagné"/"Perdu", pas la date de consultation.
  async update(id: string, dto: UpdateProspectDto, auteurId?: string) {
    const avant = await this.prisma.prospect.findUnique({ where: { id } });
    if (!avant) throw new NotFoundException(`Prospect ${id} introuvable`);
    await this.prisma.prospect.update({ where: { id }, data: dto });
    if (dto.etape !== undefined && dto.etape !== avant.etape) {
      await this.prisma.prospectHistorique.create({
        data: {
          prospectId: id, auteurId, type: "ChangementEtape", etapeAvant: avant.etape, etapeApres: dto.etape,
          description: `Étape changée : "${avant.etape}" → "${dto.etape}"`,
        },
      });
    }
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.prospect.delete({ where: { id } });
    return { id };
  }

  // Note libre (2026-08) — complète le changement d'étape automatique
  // ci-dessus pour tout autre événement notable (appel, relance, réponse
  // du prospect...) — voir demande utilisateur.
  async ajouterNote(id: string, description: string, auteurId?: string) {
    await this.findOne(id);
    await this.prisma.prospectHistorique.create({ data: { prospectId: id, auteurId, type: "Note", description } });
    return this.findOne(id);
  }

  // Conversion en client (2026-08) — voir demande utilisateur : "lesquels
  // sont devenus des clients". Lie un Client déjà créé (parcours
  // Souscripteurs habituel, inchangé) — n'invente jamais de client à la
  // place du gestionnaire.
  async lierClient(id: string, clientId: string, auteurId?: string) {
    await this.findOne(id);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} introuvable`);
    const dejaLie = await this.prisma.prospect.findUnique({ where: { clientId } });
    if (dejaLie && dejaLie.id !== id) throw new BadRequestException(`Le client ${client.nom} est déjà rattaché au prospect ${dejaLie.id}.`);
    await this.prisma.prospect.update({ where: { id }, data: { clientId } });
    await this.prisma.prospectHistorique.create({
      data: { prospectId: id, auteurId, type: "Note", description: `Dossier converti en client — ${client.nom} (${clientId})` },
    });
    return this.findOne(id);
  }

  // Suggestion de commission par compagnie (2026-08) — voir demande
  // utilisateur : "l'application doit pouvoir calculer la commission
  // possible pour chaque compagnie en fonction des taux existants. Faire
  // une analyse et suggérer." Calcul PUR (rien de stocké) à partir de
  // Prospect.valeurEstimee (prime nette estimée) × Compagnie.
  // tauxCommissionMaladie/tauxCommissionAssistance — le taux Assistance
  // n'entre en jeu que si le type de contrat envisagé l'inclut.
  async suggestionsCommission(id: string) {
    const prospect = await this.prisma.prospect.findUnique({ where: { id } });
    if (!prospect) throw new NotFoundException(`Prospect ${id} introuvable`);
    const compagnies = await this.prisma.compagnie.findMany({
      select: { id: true, nom: true, logo: true, tauxCommissionMaladie: true, tauxCommissionAssistance: true },
      orderBy: { nom: "asc" },
    });
    const valeur = Number(prospect.valeurEstimee);
    const suggestions = calculerCommissionsProspect(
      valeur, prospect.typeContrat,
      compagnies.map((c) => ({
        id: c.id, nom: c.nom, logo: c.logo,
        tauxCommissionMaladie: c.tauxCommissionMaladie != null ? Number(c.tauxCommissionMaladie) : null,
        tauxCommissionAssistance: c.tauxCommissionAssistance != null ? Number(c.tauxCommissionAssistance) : null,
      })),
    );
    return {
      valeurEstimee: valeur, typeContrat: prospect.typeContrat,
      suggestions,
      meilleureCompagnie: suggestions[0] ?? null,
      // Moyenne toutes compagnies confondues (2026-08) — voir demande
      // utilisateur : "on doit avoir en moyen la commission que cela
      // devrait rapporter... une moyenne en fonction des différentes
      // commissions de toutes les compagnies".
      commissionMoyenneEstimee: commissionMoyenne(suggestions),
    };
  }

  // Statistiques d'évolution par exercice (2026-08) — voir demande
  // utilisateur : "l'application doit pouvoir faire analyse statistique
  // sur l'évolution de prospects. Lesquels ont été perdus pour un exercice
  // donné, lesquels sont devenus des clients." `exercice` = année civile
  // (ex. "2026") — filtre sur la date RÉELLE du passage "Gagné"/"Perdu"
  // (ProspectHistorique.date), pas sur l'état actuel du prospect (qui a pu
  // rebasculer depuis) ni sur sa date de création.
  async statistiques(exercice?: string) {
    const annee = exercice ? Number(exercice) : new Date().getFullYear();
    const debut = new Date(annee, 0, 1);
    const fin = new Date(annee + 1, 0, 1);

    const [crees, transitions, tousProspects] = await Promise.all([
      this.prisma.prospect.count({ where: { createdAt: { gte: debut, lt: fin } } }),
      this.prisma.prospectHistorique.findMany({
        where: { type: "ChangementEtape", date: { gte: debut, lt: fin }, etapeApres: { in: ["Gagné", "Perdu"] } },
        include: { prospect: { select: { id: true, nom: true, valeurEstimee: true, commercial: true, clientId: true } } },
        orderBy: { date: "desc" },
      }),
      this.prisma.prospect.findMany({ select: { id: true, etape: true, valeurEstimee: true, commercial: true, createdAt: true } }),
    ]);

    // Une même affaire peut basculer plusieurs fois (ex. relancée après un
    // "Perdu") — seule la DERNIÈRE transition de l'exercice compte par
    // prospect, pour ne pas la compter deux fois dans les totaux.
    const derniereParProspect = new Map<string, (typeof transitions)[number]>();
    for (const t of transitions) {
      if (!derniereParProspect.has(t.prospectId)) derniereParProspect.set(t.prospectId, t);
    }
    const gagnes = [...derniereParProspect.values()].filter((t) => t.etapeApres === "Gagné");
    const perdus = [...derniereParProspect.values()].filter((t) => t.etapeApres === "Perdu");

    const parCommercialMap = new Map<string, { commercial: string; crees: number; gagnes: number; perdus: number }>();
    for (const p of tousProspects) {
      if (p.createdAt >= debut && p.createdAt < fin) {
        const e = parCommercialMap.get(p.commercial) ?? { commercial: p.commercial, crees: 0, gagnes: 0, perdus: 0 };
        e.crees++;
        parCommercialMap.set(p.commercial, e);
      }
    }
    for (const t of gagnes) {
      const e = parCommercialMap.get(t.prospect.commercial) ?? { commercial: t.prospect.commercial, crees: 0, gagnes: 0, perdus: 0 };
      e.gagnes++;
      parCommercialMap.set(t.prospect.commercial, e);
    }
    for (const t of perdus) {
      const e = parCommercialMap.get(t.prospect.commercial) ?? { commercial: t.prospect.commercial, crees: 0, gagnes: 0, perdus: 0 };
      e.perdus++;
      parCommercialMap.set(t.prospect.commercial, e);
    }

    return {
      exercice: annee,
      prospectsCrees: crees,
      gagnes: {
        total: gagnes.length,
        valeurTotale: gagnes.reduce((s, t) => s + Number(t.prospect.valeurEstimee), 0),
        convertisEnClient: gagnes.filter((t) => !!t.prospect.clientId).length,
        liste: gagnes.map((t) => ({ prospectId: t.prospectId, nom: t.prospect.nom, valeurEstimee: Number(t.prospect.valeurEstimee), date: t.date, convertiEnClient: !!t.prospect.clientId })),
      },
      perdus: {
        total: perdus.length,
        valeurTotale: perdus.reduce((s, t) => s + Number(t.prospect.valeurEstimee), 0),
        liste: perdus.map((t) => ({ prospectId: t.prospectId, nom: t.prospect.nom, valeurEstimee: Number(t.prospect.valeurEstimee), date: t.date })),
      },
      tauxTransformation: gagnes.length + perdus.length > 0 ? Math.round((gagnes.length / (gagnes.length + perdus.length)) * 100) : 0,
      parCommercial: [...parCommercialMap.values()].sort((a, b) => b.gagnes - a.gagnes),
    };
  }

  // Même pattern que CompagniesService.uploadLogo/deleteLogo — utilisé sur
  // le document de cotation à la place du nom du client dans l'en-tête.
  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("logos-prospects", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_LOGOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_LOGOS_DIR, filename), file.buffer);
    }
    await this.prisma.prospect.update({ where: { id }, data: { logo: filename } });
    return this.findOne(id);
  }

  async deleteLogo(id: string) {
    const p = await this.findOne(id);
    if (p.logo) {
      if (this.storage.actif) await this.storage.delete("logos-prospects", p.logo);
      else await fs.promises.unlink(path.join(UPLOADS_LOGOS_DIR, p.logo)).catch(() => undefined);
    }
    await this.prisma.prospect.update({ where: { id }, data: { logo: null } });
    return this.findOne(id);
  }
}

import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { withComputedPrime, type PrimeInput } from "../contrats/prime.util";
import { CreateAvenantDto } from "./dto/create-avenant.dto";
import { UpdateAvenantDto } from "./dto/update-avenant.dto";

const INCLUDE = { contrat: { include: { client: true, compagnie: true } }, avenantAssures: true } as const;

// Champs de calcul de prime (mêmes que Contrat, voir prime.util.ts) recopiés
// depuis un avenant vers le contrat au moment de son application — seuls les
// champs réellement renseignés sur l'avenant sont recopiés (un avenant
// Incorporation/Retrait ou une résiliation n'en porte aucun).
const CHAMPS_PRIME = [
  "nombreAssuresPrincipaux", "primeUnitaireAssurePrincipal",
  "nombreConjoints", "primeUnitaireConjoint",
  "nombreEnfants", "primeUnitaireEnfant",
  "nombreCouples", "primeUnitaireCouple",
  "tauxMinoMajoration", "tauxReductionCommerciale",
  "montantAccessoires", "tauxCommission",
  "primeNette", "primeTotaleHT", "montantTaxe", "montantCommission",
] as const;

function addYears(dateStr: string, years: number): string {
  const [d, m, y] = dateStr.split("/").map(Number);
  const date = Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) ? new Date(y, m - 1, d) : new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toLocaleDateString("fr-FR");
}

function veille(dateStr: string): string {
  const [d, m, y] = dateStr.split("/").map(Number);
  const date = Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) ? new Date(y, m - 1, d) : new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("fr-FR");
}

@Injectable()
export class AvenantsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.avenant.findMany({ include: INCLUDE });
  }

  // Portail client (2026-08) — voir demande utilisateur : page dédiée au
  // contrat listant "l'affaire nouvelle, les avenants". Trié par createdAt
  // (Date réelle) plutôt que dateEffet (chaîne JJ/MM/AAAA, non triable
  // lexicographiquement de façon fiable).
  findByContrat(contratId: string) {
    return this.prisma.avenant.findMany({ where: { contratId }, include: INCLUDE, orderBy: { createdAt: "asc" } });
  }

  async findOne(id: string) {
    const avenant = await this.prisma.avenant.findUnique({ where: { id }, include: INCLUDE });
    if (!avenant) throw new NotFoundException(`Avenant ${id} introuvable`);
    return avenant;
  }

  // Fenêtre "Créer un avenant" = même système de calcul de prime que la
  // création de contrat (withComputedPrime) — seule différence : ça
  // s'applique à un contrat déjà existant. Le prorata se base sur la
  // nouvelle période (dateEffet/dateFin de l'avenant) pour un Renouvellement,
  // sur la période courante du contrat pour les autres types.
  async create(dto: CreateAvenantDto) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: dto.contratId } });
    if (!contrat) throw new NotFoundException("Contrat introuvable");

    const calcule = withComputedPrime({
      dateDebut: dto.type === "Renouvellement" ? dto.dateEffet : contrat.dateDebut,
      dateFin: dto.type === "Renouvellement" ? (dto.dateFin ?? contrat.dateFin) : contrat.dateFin,
      nombreAssuresPrincipaux: dto.nombreAssuresPrincipaux, primeUnitaireAssurePrincipal: dto.primeUnitaireAssurePrincipal,
      nombreConjoints: dto.nombreConjoints, primeUnitaireConjoint: dto.primeUnitaireConjoint,
      nombreEnfants: dto.nombreEnfants, primeUnitaireEnfant: dto.primeUnitaireEnfant,
      nombreCouples: dto.nombreCouples, primeUnitaireCouple: dto.primeUnitaireCouple,
      tauxMinoMajoration: dto.tauxMinoMajoration, tauxReductionCommerciale: dto.tauxReductionCommerciale,
      montantAccessoires: dto.montantAccessoires, tauxCommission: dto.tauxCommission,
    }) as PrimeInput & {
      prime?: number; primeNette?: number; primeTotaleHT?: number; montantTaxe?: number; montantCommission?: number;
    };

    return this.prisma.avenant.create({
      data: {
        id: `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        contratId: dto.contratId, type: dto.type, description: dto.description,
        primeAvant: dto.primeAvant, primeApres: calcule.prime ?? dto.primeApres,
        dateEffet: dto.dateEffet, dateFin: dto.dateFin, statut: dto.statut,
        exerciceNumero: contrat.exerciceNumero,
        nombreAssuresPrincipaux: dto.nombreAssuresPrincipaux, primeUnitaireAssurePrincipal: dto.primeUnitaireAssurePrincipal,
        nombreConjoints: dto.nombreConjoints, primeUnitaireConjoint: dto.primeUnitaireConjoint,
        nombreEnfants: dto.nombreEnfants, primeUnitaireEnfant: dto.primeUnitaireEnfant,
        nombreCouples: dto.nombreCouples, primeUnitaireCouple: dto.primeUnitaireCouple,
        tauxMinoMajoration: dto.tauxMinoMajoration, tauxReductionCommerciale: dto.tauxReductionCommerciale,
        montantAccessoires: calcule.montantAccessoires ?? dto.montantAccessoires, tauxCommission: dto.tauxCommission,
        primeNette: calcule.primeNette, primeTotaleHT: calcule.primeTotaleHT,
        montantTaxe: calcule.montantTaxe, montantCommission: calcule.montantCommission,
        sinistralite: dto.sinistralite, motif: dto.motif, ristourne: dto.ristourne, initiateur: dto.initiateur,
        compagnieAvantId: dto.compagnieAvantId, compagnieApresId: dto.compagnieApresId,
      },
      include: INCLUDE,
    });
  }

  async update(id: string, dto: UpdateAvenantDto) {
    await this.findOne(id);
    return this.prisma.avenant.update({ where: { id }, data: dto, include: INCLUDE });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.avenant.delete({ where: { id } });
    return { id };
  }

  // Bascule de statut simple (utilisée par les adaptateurs Renouvellements/
  // Résiliations pour Relancer/Marquer perdu/Valider — pas de recalcul de
  // prime, juste un changement d'état).
  async setStatut(id: string, statut: string) {
    await this.findOne(id);
    return this.prisma.avenant.update({ where: { id }, data: { statut }, include: INCLUDE });
  }

  // Point d'exécution UNIQUE : "appliquer" un avenant écrit ses effets sur
  // le Contrat, quel que soit son type. Avant cette unification,
  // RenouvellementsService.renouveler() et ResiliationsService.
  // rendreEffective() dupliquaient chacun leur propre logique déconnectée
  // d'Avenant — désormais tout passe par ici.
  async appliquer(id: string) {
    const avenant = await this.findOne(id);
    const contrat = avenant.contrat;

    if (avenant.type === "Renouvellement") {
      await this.prisma.exercice.updateMany({
        where: { contratId: avenant.contratId, numero: contrat.exerciceNumero },
        data: { statut: "Clôturé" },
      });
      const nouvelExercice = contrat.exerciceNumero + 1;
      const nouvelleDateFin = avenant.dateFin ?? addYears(avenant.dateEffet, 1);
      const contratMaj = await this.prisma.contrat.update({
        where: { id: avenant.contratId },
        data: {
          dateDebut: avenant.dateEffet, dateFin: nouvelleDateFin,
          prime: avenant.primeApres, statut: "Actif", exerciceNumero: nouvelExercice,
          ...this.champsPrimeDepuisAvenant(avenant),
        },
      });
      await this.prisma.exercice.create({
        data: {
          contratId: avenant.contratId, numero: nouvelExercice,
          dateDebut: contratMaj.dateDebut, dateFin: contratMaj.dateFin,
          periodicite: contratMaj.periodicite, prime: contratMaj.prime, statut: "Actif",
        },
      });
    } else if (avenant.type === "Changement de Compagnie") {
      // Scinde l'exercice en cours (même numero, nouvelle compagnieId) au
      // lieu d'en ouvrir un nouveau — un changement de compagnie n'est pas
      // un renouvellement, les dates du contrat ne bougent pas. L'historique
      // "quelle compagnie à quelle période" reste consultable via les
      // lignes Exercice passées (voir GET /contrats/:id/historique-compagnie).
      const exerciceActuel = await this.prisma.exercice.findFirst({
        where: { contratId: avenant.contratId, numero: contrat.exerciceNumero, statut: "Actif" },
      });
      const finPeriode = exerciceActuel?.dateFin ?? contrat.dateFin;
      await this.prisma.exercice.updateMany({
        where: { contratId: avenant.contratId, numero: contrat.exerciceNumero, statut: "Actif" },
        data: { dateFin: veille(avenant.dateEffet), statut: "Clôturé", compagnieId: avenant.compagnieAvantId ?? contrat.compagnieId },
      });
      await this.prisma.exercice.create({
        data: {
          contratId: avenant.contratId, numero: contrat.exerciceNumero,
          dateDebut: avenant.dateEffet, dateFin: finPeriode,
          periodicite: contrat.periodicite, prime: contrat.prime, statut: "Actif",
          compagnieId: avenant.compagnieApresId,
        },
      });
      await this.prisma.contrat.update({ where: { id: avenant.contratId }, data: { compagnieId: avenant.compagnieApresId! } });
    } else if (avenant.type === "Résiliation") {
      // Date de résiliation / fermeture des droits (2026-09) — voir demande
      // utilisateur : "seules les prestations faites avant la date de
      // résiliation peuvent être saisies". `dateFin` sert de référence
      // partout ailleurs (SanteService.verifierSaisieAutorisee) : alignée
      // ici sur la veille de la date d'effet de l'avenant, même principe
      // que "Changement de Compagnie" ci-dessus — sinon `dateFin` restait
      // l'échéance théorique d'origine, jamais la vraie date de sortie.
      // L'exercice en cours est clôturé à la même date, jamais laissé
      // divergent (voir [[project-souscripteur-contrat-model]] Phase 5).
      const dateFinResiliation = veille(avenant.dateEffet);
      await this.prisma.$transaction([
        this.prisma.contrat.update({ where: { id: avenant.contratId }, data: { statut: "Résilié", dateFin: dateFinResiliation } }),
        this.prisma.exercice.updateMany({ where: { contratId: avenant.contratId, numero: contrat.exerciceNumero }, data: { dateFin: dateFinResiliation, statut: "Clôturé" } }),
        // Population passée en inactif (2026-09) — voir demande utilisateur
        // : "si un contrat est résilié, toute sa population passe en
        // inactif." Jamais les personnes déjà "Radié" (sortie définitive
        // déjà tracée, distincte de cette bascule réversible).
        this.prisma.assureSante.updateMany({ where: { contratId: avenant.contratId, statut: { not: "Radié" } }, data: { statut: "Suspendu" } }),
      ]);
    } else if (avenant.type === "Ajustement de Prime" || avenant.type === "Régularisation de Prime") {
      await this.prisma.contrat.update({
        where: { id: avenant.contratId },
        data: { prime: avenant.primeApres, ...this.champsPrimeDepuisAvenant(avenant) },
      });
    } else {
      // Incorporation / Retrait : déjà appliqués par MouvementsService au
      // moment de l'action réelle — simple repli si jamais appelé à la main.
      await this.prisma.contrat.update({ where: { id: avenant.contratId }, data: { prime: avenant.primeApres } });
    }

    return this.prisma.avenant.update({ where: { id }, data: { statut: "Appliqué" }, include: INCLUDE });
  }

  private champsPrimeDepuisAvenant(avenant: Record<string, unknown>): Prisma.ContratUpdateInput {
    const data: Record<string, unknown> = {};
    for (const champ of CHAMPS_PRIME) {
      if (avenant[champ] !== null && avenant[champ] !== undefined) data[champ] = avenant[champ];
    }
    return data as Prisma.ContratUpdateInput;
  }

  // ── Worklist Renouvellement (utilisée par RenouvellementsService) ─────
  async findOrCreateBrouillonRenouvellement(contratId: string) {
    const existant = await this.prisma.avenant.findFirst({
      where: { contratId, type: "Renouvellement", statut: { not: "Appliqué" } },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    if (existant) return existant;

    const contrat = await this.prisma.contrat.findUniqueOrThrow({ where: { id: contratId } });
    const id = `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    return this.prisma.avenant.create({
      data: {
        id, contratId, type: "Renouvellement",
        description: `Renouvellement proposé — exercice n°${contrat.exerciceNumero + 1}`,
        primeAvant: contrat.prime, primeApres: contrat.prime,
        dateEffet: contrat.dateFin, dateFin: addYears(contrat.dateFin, 1),
        statut: "À renouveler", exerciceNumero: contrat.exerciceNumero,
        nombreAssuresPrincipaux: contrat.nombreAssuresPrincipaux, primeUnitaireAssurePrincipal: contrat.primeUnitaireAssurePrincipal,
        nombreConjoints: contrat.nombreConjoints, primeUnitaireConjoint: contrat.primeUnitaireConjoint,
        nombreEnfants: contrat.nombreEnfants, primeUnitaireEnfant: contrat.primeUnitaireEnfant,
        nombreCouples: contrat.nombreCouples, primeUnitaireCouple: contrat.primeUnitaireCouple,
        tauxMinoMajoration: contrat.tauxMinoMajoration, tauxReductionCommerciale: contrat.tauxReductionCommerciale,
        montantAccessoires: contrat.montantAccessoires, tauxCommission: contrat.tauxCommission,
      },
      include: INCLUDE,
    });
  }
}

import { randomUUID } from "crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { echeanceParDefaut, echeanceValide, lendemain, normaliserEcheance } from "../contrats/echeance.util";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ecrireTraceAudit } from "../audit/audit-trail.util";
import { withComputedPrime, type PrimeInput } from "../contrats/prime.util";
import { CreateAvenantDto } from "./dto/create-avenant.dto";
import { UpdateAvenantDto } from "./dto/update-avenant.dto";
import { synchroniserStatutSouscripteurs } from "../clients/statut-souscripteur.util";

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

// Vocabulaire de statut d'un avenant (schema.prisma Avenant.statut, DTO
// create-avenant, frontend services/avenants.service.ts) : "Brouillon" |
// "Validé" | "Appliqué" | "Relancé" | "Perdu" | "À renouveler".
// Les adaptateurs Résiliations ("Demandée"/"Validée"/"Effective") et
// Renouvellements ("Renouvelé") exposent des libellés externes, ramenés ici
// au vocabulaire interne.
const STATUTS_AVENANT = ["Brouillon", "Validé", "Appliqué", "Relancé", "Perdu", "À renouveler"] as const;
const ALIAS_STATUT: Record<string, string> = { "Demandée": "Brouillon", "Validée": "Validé", "Effective": "Appliqué", "Renouvelé": "Appliqué" };
// États terminaux : plus aucune sortie possible ("Appliqué" ne s'atteint que
// par appliquer(), "Perdu" par le circuit Renouvellement).
const STATUTS_TERMINAUX = new Set<string>(["Appliqué", "Perdu"]);
// Transitions autorisées hors appliquer() (voir verifierTransition).
const TRANSITIONS: Record<string, readonly string[]> = {
  "Brouillon": ["Validé", "Relancé", "Perdu"],
  "À renouveler": ["Relancé", "Validé", "Perdu"],
  "Relancé": ["Validé", "Perdu"],
  "Validé": ["Relancé", "Perdu"],
  "Appliqué": [],
  "Perdu": [],
};
// Champs financiers/structurants figés dès qu'un avenant est terminal.
const CHAMPS_FINANCIERS = [
  "contratId", "type", "primeAvant", "primeApres", "dateEffet", "dateFin", "ristourne",
  "compagnieAvantId", "compagnieApresId", ...CHAMPS_PRIME,
] as const;

function veille(dateStr: string): string {
  const [d, m, y] = dateStr.split("/").map(Number);
  const date = Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) ? new Date(y, m - 1, d) : new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("fr-FR");
}

@Injectable()
export class AvenantsService {
  constructor(private prisma: PrismaService) {}

  // Liste allégée (2026-11, mesuré en prod : 684 avenants = 5 Mo, le contrat
  // complet recopié dans chacun) — la liste n'affiche que la police et le souscripteur.
  findAll() {
    return this.prisma.avenant.findMany({
      include: { contrat: { select: { numeroPolice: true, client: { select: { nom: true } }, compagnie: { select: { nom: true } } } }, avenantAssures: true },
    });
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
    if (dto.type === "Renouvellement") {
      dto.dateFin = dto.dateFin ? normaliserEcheance(dto.dateEffet, dto.dateFin) : echeanceParDefaut(dto.dateEffet);
    }

    const calcule = withComputedPrime({
      dateDebut: dto.type === "Renouvellement" ? dto.dateEffet : contrat.dateDebut,
      dateFin: dto.type === "Renouvellement" ? dto.dateFin! : contrat.dateFin,
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

  // Statut résolu vers le vocabulaire interne (les adaptateurs
  // Résiliations/Renouvellements gèrent aussi des libellés externes) ; refuse
  // tout statut inconnu.
  private normaliserStatut(statut: string): string {
    const interne = ALIAS_STATUT[statut] ?? statut;
    if (!(STATUTS_AVENANT as readonly string[]).includes(interne)) {
      throw new BadRequestException(`Statut d'avenant inconnu : « ${statut} ». Valeurs admises : ${STATUTS_AVENANT.join(", ")}.`);
    }
    return interne;
  }

  // Transition manuelle (hors appliquer, seul chemin vers "Appliqué") :
  // aucun retour depuis un état terminal, pas de saut hors de la carte.
  private verifierTransition(de: string, vers: string) {
    if (vers === de) {
      if (STATUTS_TERMINAUX.has(de)) throw new ConflictException(`L'avenant est déjà « ${de} » : état terminal.`);
      return;
    }
    if (vers === "Appliqué") throw new ConflictException("Un avenant ne passe à « Appliqué » qu'en l'appliquant au contrat (action « Appliquer »).");
    if (!(TRANSITIONS[de] ?? []).includes(vers)) {
      throw new ConflictException(`Transition de statut interdite : « ${de} » → « ${vers} ».`);
    }
  }

  // Vérification préalable exposée aux adaptateurs (ex. marquer un
  // renouvellement perdu) avant d'engager des effets de bord.
  async verifierChangementStatut(id: string, statut: string) {
    const avenant = await this.findOne(id);
    this.verifierTransition(avenant.statut, this.normaliserStatut(statut));
    return avenant;
  }

  async update(id: string, dto: UpdateAvenantDto) {
    const courant = await this.findOne(id);
    if (dto.statut !== undefined) this.verifierTransition(courant.statut, this.normaliserStatut(dto.statut));
    if (STATUTS_TERMINAUX.has(courant.statut)) {
      const touches = CHAMPS_FINANCIERS.filter((champ) => (dto as Record<string, unknown>)[champ] !== undefined);
      if (touches.length > 0) {
        throw new ConflictException(`Avenant « ${courant.statut} » : les champs financiers (${touches.join(", ")}) ne sont plus modifiables.`);
      }
    }
    // Écriture conditionnelle sur le statut lu : une application concurrente
    // entre-temps rend la mise à jour caduque (409) au lieu de l'écraser.
    const r = await this.prisma.avenant.updateMany({ where: { id, statut: courant.statut }, data: dto });
    if (r.count === 0) throw new ConflictException("L'avenant a été modifié entre-temps — rechargez puis recommencez.");
    return this.findOne(id);
  }

  // Suppression refusée pour un avenant appliqué (effets déjà écrits sur le
  // contrat), ayant émis une quittance (numeroQuittance) ou repris sur une
  // facture de production. Trace d'audit écrite avec le détail supprimé.
  async remove(id: string) {
    const avenant = await this.findOne(id);
    if (avenant.statut === "Appliqué") {
      throw new ConflictException("Impossible de supprimer un avenant déjà appliqué au contrat.");
    }
    if (avenant.numeroQuittance !== null) {
      throw new ConflictException("Impossible de supprimer : une quittance a déjà été émise pour cet avenant.");
    }
    const lignesFacturees = await this.prisma.factureProductionLigne.count({ where: { avenantId: id } });
    if (lignesFacturees > 0) {
      throw new ConflictException("Impossible de supprimer : cet avenant figure sur une facture de production.");
    }
    await this.prisma.avenant.delete({ where: { id } });
    await ecrireTraceAudit(this.prisma, "avenants", id, "Supprimé", {
      contratId: avenant.contratId, type: avenant.type, statut: avenant.statut, dateEffet: avenant.dateEffet,
      primeAvant: avenant.primeAvant.toString(), primeApres: avenant.primeApres.toString(),
    });
    return { id };
  }

  // Bascule de statut simple (utilisée par les adaptateurs Renouvellements/
  // Résiliations pour Relancer/Marquer perdu/Valider — pas de recalcul de
  // prime, juste un changement d'état) : vocabulaire et transitions contrôlés.
  async setStatut(id: string, statut: string) {
    const courant = await this.findOne(id);
    const cible = this.normaliserStatut(statut);
    this.verifierTransition(courant.statut, cible);
    const r = await this.prisma.avenant.updateMany({ where: { id, statut: courant.statut }, data: { statut: cible } });
    if (r.count === 0) throw new ConflictException("L'avenant a été modifié entre-temps — rechargez puis recommencez.");
    return this.findOne(id);
  }

  // Point d'exécution UNIQUE : "appliquer" un avenant écrit ses effets sur
  // le Contrat, quel que soit son type. Avant cette unification,
  // RenouvellementsService.renouveler() et ResiliationsService.
  // rendreEffective() dupliquaient chacun leur propre logique déconnectée
  // d'Avenant — désormais tout passe par ici.
  // Un avenant ne s'applique qu'UNE fois : le passage à "Appliqué" est
  // réservé atomiquement avant d'écrire les effets (une seconde application
  // concurrente ou tardive reçoit un 409) et restauré si les effets échouent.
  async appliquer(id: string, compagnieId?: string) {
    const avenant = await this.findOne(id);
    if (avenant.statut === "Appliqué") throw new ConflictException("Cet avenant a déjà été appliqué au contrat.");
    if (avenant.statut === "Perdu") throw new ConflictException("Un avenant « Perdu » ne peut pas être appliqué.");
    const reserve = await this.prisma.avenant.updateMany({ where: { id, statut: avenant.statut }, data: { statut: "Appliqué" } });
    if (reserve.count === 0) throw new ConflictException("L'avenant a été modifié ou appliqué entre-temps — rechargez puis recommencez.");
    try {
      await this.executerEffets(avenant, compagnieId);
    } catch (err) {
      await this.prisma.avenant.updateMany({ where: { id, statut: "Appliqué" }, data: { statut: avenant.statut } }).catch(() => undefined);
      throw err;
    }
    return this.findOne(id);
  }

  private async executerEffets(avenant: Awaited<ReturnType<AvenantsService["findOne"]>>, compagnieId?: string) {
    const contrat = avenant.contrat;

    if (avenant.type === "Renouvellement") {
      const nouvelExercice = contrat.exerciceNumero + 1;
      // Échéance = veille de l'anniversaire, jamais le même jour que la date d'effet.
      const nouvelleDateFin = avenant.dateFin ? normaliserEcheance(avenant.dateEffet, avenant.dateFin) : echeanceParDefaut(avenant.dateEffet);
      if (!echeanceValide(avenant.dateEffet, nouvelleDateFin)) {
        throw new BadRequestException(`Échéance ${nouvelleDateFin} invalide pour une date d'effet au ${avenant.dateEffet}.`);
      }
      await this.prisma.exercice.updateMany({
        where: { contratId: avenant.contratId, numero: contrat.exerciceNumero },
        data: { statut: "Clôturé" },
      });
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
          ...(compagnieId ? { compagnieId } : {}),
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

    // Renouvellement / Résiliation : statut du souscripteur réaligné sur ses
    // contrats (voir clients/statut-souscripteur.util.ts).
    await synchroniserStatutSouscripteurs(this.prisma, [contrat.clientId]);
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
        // Le renouvellement démarre le lendemain de l'échéance en cours.
        dateEffet: lendemain(contrat.dateFin), dateFin: echeanceParDefaut(lendemain(contrat.dateFin)),
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

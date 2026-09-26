import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { AssureSante, Contrat, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { withComputedPrime } from "../contrats/prime.util";
import { verifierAge } from "./age-limite.util";
import { creerGenerateurMatricule } from "../sante/matricule.util";

type AssureAvecRelations = Prisma.AssureSanteGetPayload<{ include: { contrat: true; membres: true } }>;

// Format DD/MM/YYYY utilisé partout dans l'app pour les dates saisies.
function parseDateFr(s: string): Date {
  const [j, m, a] = s.split("/").map(Number);
  return new Date(a, m - 1, j);
}

function aujourdhuiFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export interface AjoutMouvement {
  nom: string;
  prenom?: string;
  matricule?: string;
  beneficiaires: number;
  cotisation: number;
  dateNaissance?: string;
  statutMatrimonial?: string;
  typeAssure?: string; // AS | CJ | EF
  familleId?: string | null;
  telephone?: string;
  // Enfant (EF) encore scolarisé — voir age-limite.util.ts.
  scolarise?: boolean;
  // Fiche détaillée individuelle — voir schema.prisma AssureSante.
  sexe?: string;
  adresse?: string;
  nomJeuneFille?: string;
  lieuNaissance?: string;
  email?: string;
  telephoneFixe?: string;
  autreNumero?: string;
  fax?: string;
  // Photo (2026-08) — nom de fichier déjà présent sous uploads/photos/ (voir
  // demande utilisateur, portail client : "rendre possible l'ajout des
  // photos pour rendre possible l'édition des cartes côté assurance").
  photo?: string;
}

export interface RetraitMouvement {
  assureId: string;
  motif?: string;
}

// Point d'entrée UNIQUE pour toute variation de population sur un contrat
// déjà existant — que le mouvement vienne de l'écran Contrats ("Gérer les
// assurés", ajouts/retraits groupés) ou de l'écran Participants (affiliation
// ou retrait d'une seule personne). Avant cette unification, les deux
// écrans dupliquaient chacun leur propre logique, avec des incohérences
// réelles : les CJ/EF ajoutés depuis Contrats ne rejoignaient jamais leur
// famille (familleId jamais posé), et les créations/retraits depuis
// Participants ne touchaient jamais aux compteurs de population/prime du
// contrat ni ne généraient d'avenant. Cette unification corrige les deux et
// garantit que "qui a été incorporé/retiré durant telle période" se répond
// de façon fiable quel que soit l'écran d'origine (table AvenantAssure).
@Injectable()
export class MouvementsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // Rattrape au démarrage toute radiation automatique en retard (ex. serveur
  // éteint le jour anniversaire d'un assuré — fréquent en environnement de
  // dev) — voir radierHorsLimiteAge, idempotent.
  async onModuleInit() {
    await this.radierHorsLimiteAge();
  }

  async appliquerMouvement(contratId: string, dateEffet: string, ajouts: AjoutMouvement[], retraits: RetraitMouvement[]) {
    const contrat = await this.prisma.contrat.findUnique({ where: { id: contratId } });
    if (!contrat) throw new NotFoundException(`Contrat ${contratId} introuvable`);
    const primeAvant = Number(contrat.prime);
    const delta = { AS: 0, CJ: 0, EF: 0 };

    const dateReference = parseDateFr(dateEffet);
    for (const a of ajouts) {
      const erreurAge = verifierAge(contrat, { typeAssure: a.typeAssure ?? (a.familleId ? undefined : "AS"), dateNaissance: a.dateNaissance, scolarise: a.scolarise }, dateReference);
      if (erreurAge) throw new BadRequestException(erreurAge);
    }

    // Préfixe matricule propre à la société (2026-09) — voir
    // matricule.util.ts. UN SEUL générateur pour tout le lot d'ajouts
    // (plusieurs personnes peuvent être ajoutées dans le même appel,
    // ex. principal + ayants droit) — jamais un rescan base par personne,
    // qui produirait des doublons puisque rien n'est encore committé tant
    // que la boucle tourne. Repli sur MAT-<suffix> inchangé si aucun
    // préfixe n'est configuré.
    const genererMatricule = await creerGenerateurMatricule(this.prisma);

    const crees: AssureAvecRelations[] = [];
    for (const a of ajouts) {
      // 12 caractères (2026-09, était 6) — voir sante.service.ts
      // importPopulation pour le même correctif (collision d'id constatée
      // en production sur une table déjà volumineuse).
      const suffix = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
      const id = `ASS-${suffix}`;
      const matricule = a.matricule?.trim() || genererMatricule();
      const identite = await this.prisma.identiteAssuree.upsert({
        where: { matricule },
        update: { nom: a.nom, prenom: a.prenom ?? undefined },
        create: { matricule, nom: a.nom, prenom: a.prenom },
      });
      await this.prisma.matriculeAssuree.upsert({
        where: { matricule },
        update: { identiteId: identite.id, statut: "Actuel" },
        create: { matricule, identiteId: identite.id, statut: "Actuel" },
      });
      const cree = await this.prisma.assureSante.create({
        data: {
          id,
          contratId,
          identiteId: identite.id,
          nom: a.nom,
          prenom: a.prenom,
          matricule,
          beneficiaires: a.beneficiaires,
          cotisation: a.cotisation,
          dateNaissance: a.dateNaissance,
          statutMatrimonial: a.statutMatrimonial,
          typeAssure: a.typeAssure ?? (a.familleId ? undefined : "AS"),
          scolarise: a.scolarise ?? false,
          familleId: a.familleId ?? undefined,
          telephone: a.familleId ? undefined : a.telephone?.trim() || undefined,
          sexe: a.sexe,
          adresse: a.adresse,
          nomJeuneFille: a.nomJeuneFille,
          lieuNaissance: a.lieuNaissance,
          email: a.email,
          telephoneFixe: a.telephoneFixe,
          autreNumero: a.autreNumero,
          fax: a.fax,
          photo: a.photo,
          dateAffiliation: dateEffet,
          statut: "Actif",
          numeroAssure: `MED-SAN-${suffix}`,
          qrCode: `QR-MED-${suffix}`,
          statutCarte: "Active",
        },
        include: { contrat: true, membres: true },
      });
      crees.push(cree);
      const t = (cree.typeAssure ?? "").toUpperCase();
      if (t === "AS" || t === "CJ" || t === "EF") delta[t as "AS" | "CJ" | "EF"]++;
    }

    // Radiation douce, cascadée à toute la famille si l'id retiré est une
    // racine (un assuré principal = 1 famille) — dédupliquée pour ne jamais
    // radier deux fois la même personne (root explicite + membre cascadé).
    const motifParId = new Map<string, string | undefined>();
    for (const r of retraits) motifParId.set(r.assureId, r.motif);
    for (const r of retraits) {
      const existant = await this.prisma.assureSante.findUnique({ where: { id: r.assureId }, include: { membres: true } });
      if (!existant || existant.statut === "Radié") continue;
      if (existant.familleId === null) {
        for (const m of existant.membres) {
          if (m.statut !== "Radié" && !motifParId.has(m.id)) motifParId.set(m.id, r.motif);
        }
      }
    }

    const radies: AssureAvecRelations[] = [];
    for (const [assureId, motif] of motifParId) {
      const existant = await this.prisma.assureSante.findUnique({ where: { id: assureId } });
      if (!existant || existant.statut === "Radié") continue;
      const radie = await this.prisma.assureSante.update({
        where: { id: assureId },
        data: { statut: "Radié", dateRadiation: dateEffet, motifRadiation: motif ?? "Retrait (avenant)" },
        include: { contrat: true, membres: true },
      });
      radies.push(radie);
      const t = (radie.typeAssure ?? "").toUpperCase();
      if (t === "AS" || t === "CJ" || t === "EF") delta[t as "AS" | "CJ" | "EF"]--;
    }

    const contratMisAJour = await this.ajusterCompteurs(contrat, delta);

    const primeApres = Number(contratMisAJour.prime);
    const avenants = [];
    if (crees.length > 0) {
      avenants.push(await this.prisma.avenant.create({
        data: {
          id: `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          contratId, type: "Incorporation",
          description: `Incorporation de ${crees.length} personne(s) : ${crees.map((c) => c.nom).join(", ")}`,
          primeAvant, primeApres, dateEffet, statut: "Appliqué", exerciceNumero: contrat.exerciceNumero,
          avenantAssures: {
            create: crees.map((c) => ({
              id: `AVA-${randomUUID().slice(0, 8).toUpperCase()}`,
              contratId, assureId: c.id, nom: c.nom, prenom: c.prenom, matricule: c.matricule,
              typeAssure: c.typeAssure, action: "Incorporation", dateEffet,
            })),
          },
        },
        include: { contrat: { include: { client: true } }, avenantAssures: true },
      }));
    }
    if (radies.length > 0) {
      avenants.push(await this.prisma.avenant.create({
        data: {
          id: `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          contratId, type: "Retrait",
          description: `Retrait de ${radies.length} personne(s) : ${radies.map((r) => r.nom).join(", ")}`,
          primeAvant, primeApres, dateEffet, statut: "Appliqué", exerciceNumero: contrat.exerciceNumero,
          avenantAssures: {
            create: radies.map((r) => ({
              id: `AVA-${randomUUID().slice(0, 8).toUpperCase()}`,
              contratId, assureId: r.id, nom: r.nom, prenom: r.prenom, matricule: r.matricule,
              typeAssure: r.typeAssure, action: "Retrait", dateEffet,
            })),
          },
        },
        include: { contrat: { include: { client: true } }, avenantAssures: true },
      }));
    }

    return { contrat: contratMisAJour, avenants, crees, radies };
  }

  // Recalcule les compteurs agrégés (nombreAssuresPrincipaux/Conjoints/
  // Enfants) et la prime d'un contrat après une variation de population,
  // par catégorie — partagé entre appliquerMouvement (ajouts/retraits) et
  // basculerVersContrat, pour ne jamais dupliquer ce calcul.
  private async ajusterCompteurs(contrat: Contrat, delta: { AS: number; CJ: number; EF: number }) {
    const nombreAssuresPrincipaux = Math.max(0, (contrat.nombreAssuresPrincipaux ?? 0) + delta.AS);
    const nombreConjoints = Math.max(0, (contrat.nombreConjoints ?? 0) + delta.CJ);
    const nombreEnfants = Math.max(0, (contrat.nombreEnfants ?? 0) + delta.EF);
    const data = withComputedPrime({
      dateDebut: contrat.dateDebut, dateFin: contrat.dateFin,
      nombreAssuresPrincipaux, primeUnitaireAssurePrincipal: Number(contrat.primeUnitaireAssurePrincipal ?? 0),
      nombreConjoints, primeUnitaireConjoint: Number(contrat.primeUnitaireConjoint ?? 0),
      nombreEnfants, primeUnitaireEnfant: Number(contrat.primeUnitaireEnfant ?? 0),
      nombreCouples: contrat.nombreCouples ?? 0, primeUnitaireCouple: Number(contrat.primeUnitaireCouple ?? 0),
      tauxMinoMajoration: Number(contrat.tauxMinoMajoration ?? 0), tauxReductionCommerciale: Number(contrat.tauxReductionCommerciale ?? 0),
      montantAccessoires: Number(contrat.montantAccessoires ?? 0), tauxCommission: Number(contrat.tauxCommission ?? 0),
    });
    return this.prisma.contrat.update({
      where: { id: contrat.id },
      data,
      include: { client: true, compagnie: true, garanties: true },
    });
  }

  // Bascule d'un assuré seul, ou d'une famille entière, vers un autre
  // contrat SANS le recréer (même ligne AssureSante, juste contratId
  // changé) — c'est la seule façon légitime de faire passer une personne
  // d'un contrat à l'autre (ex. Collège Cadres ↔ Collège Non-Cadres, ou un
  // assuré/famille radié(e) depuis des années qui revient, même
  // souscripteur ou un autre), et la raison pour laquelle aucune
  // duplication n'est possible par ce chemin (contrairement à un retrait +
  // réimport). Il n'existe PAS de type d'avenant "Transfert" — le
  // mouvement se modélise avec les deux types déjà existants : un Retrait
  // sur le contrat source, une Incorporation sur le contrat destination
  // (voir basculerLot). La personne redevient "Actif" (voir basculerLot) :
  // son historique de consommation (PriseEnCharge/AccordPrealable, qui
  // portent leur propre contratId dénormalisé) reste intact et consultable
  // sous l'ancien contrat, indépendamment de ce changement.
  // Un CJ/EF basculé seul (avecFamille=false, ou personne non racine) est
  // détaché de sa famille d'origine et devient AS de sa propre fiche dans
  // le contrat destination.
  async basculerVersContrat(assureId: string, contratDestinationId: string, avecFamille: boolean, dateEffet: string) {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureId }, include: { membres: true } });
    if (!assure) throw new NotFoundException(`Assuré ${assureId} introuvable`);
    if (assure.contratId === contratDestinationId) {
      throw new BadRequestException("Le contrat destination est identique au contrat actuel de cette personne.");
    }
    const contratDestination = await this.prisma.contrat.findUnique({ where: { id: contratDestinationId } });
    if (!contratDestination) throw new NotFoundException(`Contrat ${contratDestinationId} introuvable`);
    const contratSource = await this.prisma.contrat.findUnique({ where: { id: assure.contratId } });
    if (!contratSource) throw new NotFoundException(`Contrat ${assure.contratId} introuvable`);

    const estRacine = assure.familleId === null;
    const basculeFamille = estRacine && avecFamille;
    if (estRacine && assure.membres.length > 0 && !avecFamille) {
      throw new BadRequestException("Cette personne a des ayants droit rattachés — basculez toute la famille, ou basculez chaque ayant droit séparément.");
    }

    const aBasculer = basculeFamille ? [assure, ...assure.membres] : [assure];
    return this.basculerLot(aBasculer, contratSource, contratDestination, dateEffet, { detacherId: estRacine ? undefined : assureId });
  }

  // Bascule de TOUTE une population (ou une sélection) d'un contrat vers un
  // autre, en une seule opération — cas typique : un contrat résilié dont
  // la population (restée "Actif" sur le papier, voir AvenantsService.appliquer,
  // branche "Résiliation", qui ne touche que Contrat.statut) est reprise
  // des années plus tard par un nouveau contrat, même souscripteur ou un
  // autre. `assureIds` est complété automatiquement pour ne jamais scinder
  // une famille sélectionnée partiellement (racine sans un de ses ayants
  // droit, ou l'inverse).
  async basculerPopulationVersContrat(contratSourceId: string, contratDestinationId: string, assureIds: string[], dateEffet: string) {
    if (contratSourceId === contratDestinationId) {
      throw new BadRequestException("Le contrat destination est identique au contrat source.");
    }
    const contratSource = await this.prisma.contrat.findUnique({ where: { id: contratSourceId } });
    if (!contratSource) throw new NotFoundException(`Contrat ${contratSourceId} introuvable`);
    const contratDestination = await this.prisma.contrat.findUnique({ where: { id: contratDestinationId } });
    if (!contratDestination) throw new NotFoundException(`Contrat ${contratDestinationId} introuvable`);

    const selectionnees = await this.prisma.assureSante.findMany({ where: { id: { in: assureIds }, contratId: contratSourceId } });
    if (selectionnees.length === 0) throw new BadRequestException("Aucun assuré sélectionné pour cette bascule.");

    const racineIds = Array.from(new Set(selectionnees.map((p) => p.familleId ?? p.id)));
    const personnes = await this.prisma.assureSante.findMany({
      where: { contratId: contratSourceId, OR: [{ id: { in: racineIds } }, { familleId: { in: racineIds } }] },
    });

    return this.basculerLot(personnes, contratSource, contratDestination, dateEffet, {});
  }

  // Cœur commun à basculerVersContrat et basculerPopulationVersContrat —
  // recalcule les compteurs des deux contrats et génère les deux avenants
  // réels (Retrait sur la source, Incorporation sur la destination).
  private async basculerLot(
    personnes: AssureSante[], contratSource: Contrat, contratDestination: Contrat, dateEffet: string,
    options: { detacherId?: string },
  ) {
    const { detacherId } = options;
    const delta = { AS: 0, CJ: 0, EF: 0 };
    for (const p of personnes) {
      const t = (detacherId && p.id === detacherId ? "AS" : (p.typeAssure ?? "")).toUpperCase();
      if (t === "AS" || t === "CJ" || t === "EF") delta[t as "AS" | "CJ" | "EF"]++;
    }

    // Le contrat destination peut avoir des limites d'âge différentes
    // (souvent plus strictes) du contrat source — on revérifie systématiquement,
    // même pour une personne déjà active depuis des années sur son contrat
    // d'origine.
    const dateReferenceBascule = parseDateFr(dateEffet);
    const erreursAge = personnes
      .map((p) => verifierAge(
        contratDestination,
        { typeAssure: detacherId && p.id === detacherId ? "AS" : p.typeAssure, dateNaissance: p.dateNaissance, scolarise: p.scolarise },
        dateReferenceBascule,
      ))
      .filter((e): e is string => e !== null);
    if (erreursAge.length > 0) {
      throw new BadRequestException(`Bascule impossible — ${erreursAge.join(" ")}`);
    }

    await this.prisma.$transaction(
      personnes.map((p) =>
        this.prisma.assureSante.update({
          where: { id: p.id },
          data: {
            contratId: contratDestination.id,
            // Redevient/reste actif — une bascule n'est jamais un départ,
            // même pour un assuré radié depuis des années qui revient.
            statut: "Actif", dateRadiation: null, motifRadiation: null,
            ...(detacherId && p.id === detacherId ? { familleId: null, typeAssure: "AS" } : {}),
          },
        }),
      ),
    );

    const contratSourceMaj = await this.ajusterCompteurs(contratSource, { AS: -delta.AS, CJ: -delta.CJ, EF: -delta.EF });
    const contratDestinationMaj = await this.ajusterCompteurs(contratDestination, delta);

    const noms = personnes.map((p) => p.nom).join(", ");
    const avenantAssureData = (action: "Incorporation" | "Retrait") =>
      personnes.map((p) => ({
        id: `AVA-${randomUUID().slice(0, 8).toUpperCase()}`,
        contratId: action === "Retrait" ? contratSource.id : contratDestination.id,
        assureId: p.id, nom: p.nom, prenom: p.prenom, matricule: p.matricule,
        typeAssure: detacherId && p.id === detacherId ? "AS" : p.typeAssure,
        action, dateEffet,
      }));

    // Deux avenants RÉELS (Retrait / Incorporation) — pas de 3ᵉ type
    // "Transfert".
    const avenantSource = await this.prisma.avenant.create({
      data: {
        id: `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        contratId: contratSource.id, type: "Retrait",
        description: `Retrait de ${personnes.length} personne(s) suite à bascule vers le contrat ${contratDestination.id} : ${noms}`,
        primeAvant: Number(contratSource.prime), primeApres: Number(contratSourceMaj.prime),
        dateEffet, statut: "Appliqué", exerciceNumero: contratSource.exerciceNumero,
        avenantAssures: { create: avenantAssureData("Retrait") },
      },
      include: { contrat: { include: { client: true } }, avenantAssures: true },
    });
    const avenantDestination = await this.prisma.avenant.create({
      data: {
        id: `AVN-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        contratId: contratDestination.id, type: "Incorporation",
        description: `Incorporation de ${personnes.length} personne(s) suite à bascule depuis le contrat ${contratSource.id} : ${noms}`,
        primeAvant: Number(contratDestination.prime), primeApres: Number(contratDestinationMaj.prime),
        dateEffet, statut: "Appliqué", exerciceNumero: contratDestination.exerciceNumero,
        avenantAssures: { create: avenantAssureData("Incorporation") },
      },
      include: { contrat: { include: { client: true } }, avenantAssures: true },
    });

    return {
      contratSource: contratSourceMaj, contratDestination: contratDestinationMaj,
      avenants: [avenantSource, avenantDestination], basculees: personnes.map((p) => p.id),
    };
  }

  // Radiation systématique des assurés hors limite d'âge de leur contrat
  // (anniversaire dépassant limiteAgeAdulte/limiteAgeEnfant[Scolarise]) —
  // aucune action du gestionnaire requise, contrairement à une radiation
  // manuelle. Réutilise appliquerMouvement pour bénéficier gratuitement du
  // cascade familial déjà en place (mouvements.service.ts, boucle retraits)
  // et d'un vrai avenant Retrait tracé — exécutée chaque nuit (@Cron
  // ci-dessous) et une fois au démarrage (onModuleInit) pour rattraper tout
  // retard ; idempotente (un assuré déjà Radié n'est plus concerné).
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async radierHorsLimiteAge() {
    const aujourdhui = new Date();
    const dateEffet = aujourdhuiFr();
    const actifs = await this.prisma.assureSante.findMany({
      where: { statut: { not: "Radié" } },
      include: { contrat: true },
    });

    const violateursParContrat = new Map<string, string[]>();
    for (const a of actifs) {
      const message = verifierAge(a.contrat, { typeAssure: a.typeAssure, dateNaissance: a.dateNaissance, scolarise: a.scolarise }, aujourdhui);
      if (!message) continue;
      const liste = violateursParContrat.get(a.contratId) ?? [];
      liste.push(a.id);
      violateursParContrat.set(a.contratId, liste);
    }

    for (const [contratId, assureIds] of violateursParContrat) {
      await this.appliquerMouvement(
        contratId, dateEffet, [],
        assureIds.map((assureId) => ({ assureId, motif: "Radiation automatique — hors limite d'âge du contrat" })),
      );
    }
  }
}

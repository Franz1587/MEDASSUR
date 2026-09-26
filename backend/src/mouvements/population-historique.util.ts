import type { PrismaService } from "../prisma/prisma.service";

// Reconstitution de la population d'un contrat "telle qu'elle était" sur un
// intervalle de dates passé — nécessaire car incorporations/retraits varient
// la population en cours de vie du contrat (voir onglet Historique des
// mouvements). Source de vérité : le journal AvenantAssure (contratId,
// action Incorporation|Retrait, dateEffet), rejoué chronologiquement par
// assureId pour reconstruire ses fenêtres de présence sur CE contrat.
//
// Piège découvert en explorant : la population "fondatrice" d'un contrat n'a
// pas toujours de mouvement Incorporation — les lignes saisies manuellement à
// la création en génèrent un (via SanteService.createAssure), mais celles
// importées par CSV à la création (SanteService.importPopulation) créent les
// lignes AssureSante directement, sans passer par MouvementsService, donc
// sans aucun avenant. Une personne sans mouvement antérieur pertinent (ou
// dont le tout premier événement est un Retrait non précédé d'Incorporation)
// est donc traitée comme présente depuis Contrat.dateDebut — pas une anomalie.

function parseDateFr(s: string): Date {
  const [j, m, a] = s.split("/").map(Number);
  return new Date(a, m - 1, j);
}

interface Fenetre {
  debut: Date;
  fin: Date | null;
}

export interface PersonnePeriode {
  id: string;
  nom: string;
  prenom: string | null;
  matricule: string;
  typeAssure: string | null;
  familleId: string | null;
  dateNaissance: string | null;
  sexe: string | null;
  cotisation: string;
  scolarise: boolean;
  statutActuel: string;
  // Statut "au sens de la période demandée" — Radié si la fenêtre de
  // présence pertinente s'est refermée avant/à la date "au" (retiré dans
  // l'intervalle demandé), sinon le VRAI statut courant de la fiche
  // (Actif|Suspendu|Radié — voir bug corrigé 2026-08 : ceci collapsait
  // auparavant tout non-Radié en "Actif", masquant les Suspendu, voir
  // demande utilisateur "les vrais statuts ne remontent pas... garde par
  // défaut Actif"). Sans intervalle demandé, reflète simplement statutActuel.
  statutPeriode: "Actif" | "Suspendu" | "Radié";
  // Fin de présence DATÉE dans la période demandée (retrait/radiation avec
  // une date connue) — sert au prorata de la prime de l'exercice en cours
  // (voir contrats/prime-exercice.util.ts). null si la personne est
  // toujours couverte, ou si sa sortie n'a pas de date connue.
  finPresence?: Date | null;
}

function calculerFenetres(
  evenements: { action: string; dateEffet: string }[],
  dateDebutContrat: Date,
): Fenetre[] {
  const fenetres: Fenetre[] = [];
  let debutCourant: Date | null = null;
  for (const ev of evenements) {
    const d = parseDateFr(ev.dateEffet);
    if (ev.action === "Incorporation") {
      if (debutCourant === null) debutCourant = d;
    } else if (ev.action === "Retrait") {
      if (debutCourant !== null) {
        fenetres.push({ debut: debutCourant, fin: d });
        debutCourant = null;
      } else {
        // Retrait sans Incorporation connue sur ce contrat = personne
        // fondatrice (jamais tracée par un avenant) qui a ensuite été
        // retirée — présente depuis la mise en place du contrat.
        fenetres.push({ debut: dateDebutContrat, fin: d });
      }
    }
  }
  if (debutCourant !== null) fenetres.push({ debut: debutCourant, fin: null });
  return fenetres;
}

export async function reconstituerPopulation(
  prisma: PrismaService,
  contratId: string,
  du?: string,
  au?: string,
): Promise<PersonnePeriode[]> {
  const populationActuelle = await prisma.assureSante.findMany({ where: { contratId } });

  if (!du && !au) {
    return populationActuelle.map((a) => ({
      id: a.id, nom: a.nom, prenom: a.prenom, matricule: a.matricule, typeAssure: a.typeAssure,
      familleId: a.familleId, dateNaissance: a.dateNaissance, sexe: a.sexe, cotisation: a.cotisation.toString(),
      scolarise: a.scolarise, statutActuel: a.statut, statutPeriode: a.statut as PersonnePeriode["statutPeriode"],
    }));
  }

  const contrat = await prisma.contrat.findUniqueOrThrow({ where: { id: contratId } });
  const dateDebutContrat = parseDateFr(contrat.dateDebut);
  const dateDu = du ? parseDateFr(du) : new Date(0);
  const dateAu = au ? parseDateFr(au) : new Date(8_640_000_000_000_000);

  // Tri secondaire par date de création de l'avenant — deux mouvements
  // datés du même jour (ex. une radiation automatique suivie d'une
  // réintégration le jour même) doivent rester dans leur ordre réel, sinon
  // les fenêtres de présence calculées plus bas peuvent s'inverser.
  const mouvements = await prisma.avenantAssure.findMany({
    where: { contratId },
    orderBy: [{ dateEffet: "asc" }, { avenant: { createdAt: "asc" } }],
  });

  const evenementsParAssure = new Map<string, typeof mouvements>();
  for (const m of mouvements) {
    const liste = evenementsParAssure.get(m.assureId) ?? [];
    liste.push(m);
    evenementsParAssure.set(m.assureId, liste);
  }

  const idsConcernes = new Set<string>([...populationActuelle.map((a) => a.id), ...evenementsParAssure.keys()]);
  const parIdActuelle = new Map(populationActuelle.map((a) => [a.id, a]));
  const idsManquants = [...idsConcernes].filter((id) => !parIdActuelle.has(id));
  const fichesManquantes = idsManquants.length > 0
    ? await prisma.assureSante.findMany({ where: { id: { in: idsManquants } } })
    : [];
  const fichesParId = new Map([...populationActuelle, ...fichesManquantes].map((a) => [a.id, a]));

  const resultats: PersonnePeriode[] = [];
  for (const id of idsConcernes) {
    const fiche = fichesParId.get(id);
    if (!fiche) continue; // fiche supprimée physiquement — hors sujet ici

    let fenetres = calculerFenetres(evenementsParAssure.get(id) ?? [], dateDebutContrat);
    if (fenetres.length === 0) {
      // Aucun mouvement du tout sur ce contrat — fondateur jamais retiré.
      const finRadiation = fiche.statut === "Radié" && fiche.dateRadiation ? parseDateFr(fiche.dateRadiation) : null;
      fenetres = [{ debut: dateDebutContrat, fin: finRadiation }];
    }

    const fenetrePertinente = fenetres.find((f) => f.debut <= dateAu && (f.fin === null || f.fin >= dateDu));
    if (!fenetrePertinente) continue;

    const retirePendantPeriode = fenetrePertinente.fin !== null && fenetrePertinente.fin <= dateAu;
    const statutPeriode: PersonnePeriode["statutPeriode"] = retirePendantPeriode ? "Radié" : (fiche.statut as PersonnePeriode["statutPeriode"]);
    resultats.push({
      id: fiche.id, nom: fiche.nom, prenom: fiche.prenom, matricule: fiche.matricule, typeAssure: fiche.typeAssure,
      familleId: fiche.familleId, dateNaissance: fiche.dateNaissance, sexe: fiche.sexe, cotisation: fiche.cotisation.toString(),
      scolarise: fiche.scolarise, statutActuel: fiche.statut, statutPeriode,
      finPresence: retirePendantPeriode ? fenetrePertinente.fin : null,
    });
  }
  return resultats;
}

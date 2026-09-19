import PDFDocument from "pdfkit";
import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
}

// Tableau de bord "Pilotage Assurance" (2026-08) — voir demande
// utilisateur : "Le tableau de bord ne doit pas être codé en dur mais
// interactif et réel." Remplace src/data/mock/dashboard.mock.ts (jamais
// interrogé, une pure façade) — CHAQUE chiffre ici vient d'une vraie
// requête Prisma sur les données réelles de l'application, jamais une
// valeur devinée. Aucun concept de "budget/objectif" n'existe dans le
// schéma (rien à comparer une prime émise à un objectif fixé ailleurs) :
// la comparaison affichée est donc contre l'ANNÉE PRÉCÉDENTE (donnée
// réelle), jamais un objectif fabriqué.

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const COULEURS_VILLES = ["#C9A24A", "#0E7490", "#16A34A", "#7C3AED", "#DC2626", "#DB2777", "#0891B2"];

function anneeDe(dateFr: string | null | undefined): number | null {
  if (!dateFr) return null;
  const [, , y] = dateFr.split("/").map(Number);
  return y || null;
}
function moisDe(dateFr: string | null | undefined): number | null {
  if (!dateFr) return null;
  const [, m] = dateFr.split("/").map(Number);
  return m ? m - 1 : null;
}
function joursRestants(dateFinFr: string): number {
  const [d, m, y] = dateFinFr.split("/").map(Number);
  if (!d || !m || !y) return Infinity;
  return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86_400_000);
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService, private parametresEntreprise: ParametresEntrepriseService) {}

  async pilotage(anneeParam?: string) {
    // Années réellement disponibles (2026-08) — dérivées des VRAIS contrats
    // en base, jamais une liste figée ("2024", "2025"...) qui désynchronise
    // dès que l'exploitation avance dans le temps.
    const contratsPourAnnees = await this.prisma.contrat.findMany({ select: { dateDebut: true } });
    const anneesDisponibles = [...new Set(contratsPourAnnees.map((c) => anneeDe(c.dateDebut)).filter((y): y is number => y !== null))].sort((a, b) => b - a);
    const anneeCourante = new Date().getFullYear();
    const annee = anneeParam ? Number(anneeParam) : (anneesDisponibles.includes(anneeCourante) ? anneeCourante : anneesDisponibles[0] ?? anneeCourante);
    const anneePrecedente = annee - 1;

    // Contrats de test exclus AVANT tout (2026-09) — voir demande
    // utilisateur : "le cumul de la police n'est pas harmonisé" +
    // ContratsService.findAll, qui exclut déjà `estTest` de toute liste
    // interne ; cette requête globale ne joignait jusqu'ici jamais Contrat
    // et pouvait donc laisser des données de test fuiter dans les cumuls
    // (voir mémoire "project-famille-test-isolation" : "pas exhaustif sur
    // tous les rapports").
    const contratsNonTest = await this.prisma.contrat.findMany({ where: { estTest: false }, select: { id: true } });
    const contratsNonTestIds = contratsNonTest.map((c) => c.id);

    const [
      contrats, clients, sinistres, impayesEnCours, assuresSanteParStatut, prisesEnChargeEnAttente,
      comptesBancaires, prisesEnCharge,
    ] = await Promise.all([
      this.prisma.contrat.findMany({ where: { estTest: false }, select: { id: true, statut: true, dateDebut: true, dateFin: true, prime: true, montantCommission: true, clientId: true, client: { select: { ville: true } } } }),
      this.prisma.client.findMany({ select: { statut: true, type: true } }),
      this.prisma.sinistre.findMany({ select: { statut: true, montant: true, date: true } }),
      this.prisma.impaye.aggregate({ where: { statut: "En cours" }, _sum: { montantDu: true }, _count: true }),
      this.prisma.assureSante.groupBy({ by: ["statut"], _count: true }),
      this.prisma.accordPrealable.count({ where: { decision: "En attente" } }),
      this.prisma.compteBancaire.findMany({ select: { solde: true } }),
      // Rejeté ET Annulé exclus (2026-09) — même métrique/mêmes exclusions
      // que StatistiquesService.calculer (voir commentaire de
      // consommationLignes plus bas, "même métrique") ; excluait jusqu'ici
      // seulement Annulé, laissant passer Rejeté.
      this.prisma.priseEnCharge.findMany({
        where: { statut: { notIn: ["Rejeté", "Annulé"] }, contratId: { in: contratsNonTestIds } },
        select: { type: true, date: true, statut: true, montant: true, baseRemboursement: true, bordereau: { select: { statut: true } } },
      }),
    ]);

    // Actifs/inactifs — assurés et contrats (2026-09) — voir demande
    // utilisateur : "de la même manière qu'on remonte le nombre total des
    // assurés et des contrats, il faut clairement dire lesquels sont encore
    // actif et lesquels inactif (terminé, retiré)". Les cartes n'affichaient
    // jusqu'ici QUE le décompte déjà filtré sur "Actif" (assuresSante,
    // contratsActifs plus bas), sans jamais exposer le total ni la
    // ventilation des statuts inactifs — vocabulaire réel : AssureSante.statut
    // ∈ Actif|Suspendu|Radié (voir sante.service.ts), Contrat.statut ∈
    // Actif|En renouvellement|Expiré|Résilié (voir contrats.service.ts).
    // "Suspendu" et "Radié" sont TOUS DEUX inactifs (un assuré suspendu n'a
    // plus de couverture active, même si la bascule est réversible,
    // contrairement à un radié) ; "En renouvellement" reste un contrat en
    // vigueur (pas "terminé"), seuls "Expiré" et "Résilié" comptent comme
    // inactifs pour ne jamais présenter un contrat en cours de renouvellement
    // comme "terminé, retiré".
    const compteParStatutAssure = new Map(assuresSanteParStatut.map((g) => [g.statut, g._count]));
    const assuresSante = compteParStatutAssure.get("Actif") ?? 0;
    const assuresSanteSuspendus = compteParStatutAssure.get("Suspendu") ?? 0;
    const assuresSanteRadies = compteParStatutAssure.get("Radié") ?? 0;
    const assuresSanteTotal = assuresSanteParStatut.reduce((s, g) => s + g._count, 0);
    const assuresSanteInactifs = assuresSanteSuspendus + assuresSanteRadies;

    const contratsAnnee = contrats.filter((c) => anneeDe(c.dateDebut) === annee);
    const contratsAnneePrecedente = contrats.filter((c) => anneeDe(c.dateDebut) === anneePrecedente);
    const primesEmisesCumule = contratsAnnee.reduce((s, c) => s + Number(c.prime), 0);
    const primesEmisesAnneePrecedente = contratsAnneePrecedente.reduce((s, c) => s + Number(c.prime), 0);
    const commissionsPercues = contratsAnnee.reduce((s, c) => s + Number(c.montantCommission ?? 0), 0);
    const variationPrimesPct = primesEmisesAnneePrecedente > 0 ? ((primesEmisesCumule - primesEmisesAnneePrecedente) / primesEmisesAnneePrecedente) * 100 : null;

    const contratsActifs = contrats.filter((c) => c.statut === "Actif");
    const contratsARenouveler = contratsActifs.filter((c) => { const j = joursRestants(c.dateFin); return j >= 0 && j <= 30; });
    const contratsTotal = contrats.length;
    const contratsExpires = contrats.filter((c) => c.statut === "Expiré").length;
    const contratsResilies = contrats.filter((c) => c.statut === "Résilié").length;
    const contratsInactifs = contratsExpires + contratsResilies;

    const sinistresEnCours = sinistres.filter((s) => s.statut !== "Remboursé" && s.statut !== "Clôturé");
    const sinistresMontantAnnee = sinistres.filter((s) => anneeDe(s.date) === annee).reduce((s, x) => s + Number(x.montant), 0);
    const ratioSP = primesEmisesCumule > 0 ? (sinistresMontantAnnee / primesEmisesCumule) * 100 : 0;

    const clientsActifs = clients.filter((c) => c.statut === "Actif");
    const clientsEntreprises = clientsActifs.filter((c) => c.type === "Entreprise");

    const montantImpayes = Number(impayesEnCours._sum.montantDu ?? 0);
    const primeTotaleActive = contratsActifs.reduce((s, c) => s + Number(c.prime), 0);
    // null = pas de contrat actif pour calculer un taux dessus (2026-09) —
    // voir demande utilisateur : "le 100% de recouvrement apparaît
    // toujours" sur une société neuve, sans aucun contrat. Un 100% par
    // défaut ressemblait à une valeur fabriquée alors qu'il n'y a
    // simplement rien à recouvrer — jamais un défaut qui se fait passer
    // pour une vraie mesure.
    const tauxRecouvrement = primeTotaleActive > 0 ? Math.max(0, ((primeTotaleActive - montantImpayes) / primeTotaleActive) * 100) : null;

    const tresorerie = comptesBancaires.reduce((s, c) => s + Number(c.solde), 0);

    // Production mensuelle — année sélectionnée vs année précédente (2026-08
    // — remplace l'"Objectif" fabriqué du mock, aucune notion de budget
    // n'existant dans le schéma).
    const productionMensuelle = MOIS.map((mois, i) => ({
      mois,
      prime: contratsAnnee.filter((c) => moisDe(c.dateDebut) === i).reduce((s, c) => s + Number(c.prime), 0),
      primeAnneePrecedente: contratsAnneePrecedente.filter((c) => moisDe(c.dateDebut) === i).reduce((s, c) => s + Number(c.prime), 0),
    }));

    // Consommation mensuelle — TOUS contrats confondus (2026-09) — voir
    // demande utilisateur : "faire remonter les données de consommation
    // sans distinction de contrat dans l'application au niveau du tableau
    // de bord". Même métrique que StatistiquesService (montant réellement
    // remboursé par l'assurance — baseRemboursement en priorité, repli sur
    // montant — voir mémoire "Montant = net à payer"), mais agrégée sur
    // TOUTE la société au lieu d'un seul contrat : c'est la différence avec
    // l'écran "Statistiques", qui reste volontairement par contrat pour une
    // analyse fine (arrêté de situation à imprimer).
    const consommationLignes = prisesEnCharge.map((p) => ({ date: p.date, montant: Number(p.baseRemboursement ?? p.montant) }));
    const consommationAnnee = consommationLignes.filter((l) => anneeDe(l.date) === annee);
    const consommationAnneePrecedenteLignes = consommationLignes.filter((l) => anneeDe(l.date) === anneePrecedente);
    const consommationMensuelle = MOIS.map((mois, i) => ({
      mois,
      montant: consommationAnnee.filter((l) => moisDe(l.date) === i).reduce((s, l) => s + l.montant, 0),
      montantAnneePrecedente: consommationAnneePrecedenteLignes.filter((l) => moisDe(l.date) === i).reduce((s, l) => s + l.montant, 0),
    }));
    const consommationTotaleAnnee = consommationAnnee.reduce((s, l) => s + l.montant, 0);

    // Portefeuille par ville — poids réel de chaque ville dans la prime
    // totale des contrats ACTIFS (pas un simple comptage de clients).
    const primeParVille = new Map<string, number>();
    for (const c of contratsActifs) {
      const ville = c.client.ville?.trim() || "Non renseignée";
      primeParVille.set(ville, (primeParVille.get(ville) ?? 0) + Number(c.prime));
    }
    const totalPrimeActive = [...primeParVille.values()].reduce((a, b) => a + b, 0);
    const portefeuilleParVille = [...primeParVille.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, montant], i) => ({ name, value: totalPrimeActive > 0 ? Math.round((montant / totalPrimeActive) * 1000) / 10 : 0, color: COULEURS_VILLES[i % COULEURS_VILLES.length] }));

    // Sinistralité par type de soins — sur les VRAIES lignes PriseEnCharge
    // (le modèle Sinistre générique ne porte qu'un seul enregistrement
    // historique dans cette exploitation santé, voir demande utilisateur :
    // "Gabon-only... health-insurance-only" — le vrai détail des sinistres
    // santé vit dans PriseEnCharge). "Réglé" = ligne déjà rattachée à un
    // bordereau Payé ; "Pendant" = tout le reste (analyse en cours, pas
    // encore rattachée...).
    const parType = new Map<string, { declares: number; regles: number }>();
    for (const p of prisesEnCharge) {
      if (!parType.has(p.type)) parType.set(p.type, { declares: 0, regles: 0 });
      const t = parType.get(p.type)!;
      t.declares++;
      if (p.bordereau?.statut === "Payé") t.regles++;
    }
    const sinistraliteParType = [...parType.entries()]
      .sort((a, b) => b[1].declares - a[1].declares)
      .slice(0, 5)
      .map(([branche, v]) => ({ branche, "déclarés": v.declares, "réglés": v.regles, pendants: v.declares - v.regles }));

    const alertes: { message: string; type: "warning" | "danger"; view: string }[] = [];
    if (contratsARenouveler.length > 0) alertes.push({ message: `${contratsARenouveler.length} contrat(s) à renouveler dans les 30 prochains jours`, type: "warning", view: "renouvellements" });
    if (impayesEnCours._count > 0) alertes.push({ message: `${impayesEnCours._count} prime(s) impayée(s) — Recouvrement à relancer`, type: "danger", view: "recouvrement" });
    const sinistresEnCoursLongs = sinistresEnCours.filter((s) => { const j = joursRestants(s.date); return j !== Infinity && -j > 15; });
    if (sinistresEnCoursLongs.length > 0) alertes.push({ message: `${sinistresEnCoursLongs.length} dossier(s) sinistre en cours depuis plus de 15 jours`, type: "warning", view: "sinistres" });

    return {
      annee, anneesDisponibles: anneesDisponibles.length > 0 ? anneesDisponibles : [anneeCourante],
      primesEmisesCumule, primesEmisesAnneePrecedente, variationPrimesPct, commissionsPercues,
      tauxCommissionMoyen: primesEmisesCumule > 0 ? (commissionsPercues / primesEmisesCumule) * 100 : 0,
      contratsActifs: contratsActifs.length, contratsARenouveler: contratsARenouveler.length,
      contratsTotal, contratsInactifs, contratsExpires, contratsResilies,
      sinistresEnCours: sinistresEnCours.length, sinistresRatioSP: Math.round(ratioSP * 10) / 10,
      clientsActifs: clientsActifs.length, clientsEntreprises: clientsEntreprises.length,
      tauxRecouvrement: tauxRecouvrement !== null ? Math.round(tauxRecouvrement * 10) / 10 : null, montantImpayes,
      assuresSante, prisesEnChargeEnAttente, tresorerie,
      assuresSanteTotal, assuresSanteInactifs, assuresSanteSuspendus, assuresSanteRadies,
      productionMensuelle, portefeuilleParVille, sinistraliteParType, alertes,
      consommationMensuelle, consommationTotaleAnnee,
    };
  }

  // "Rapport PDF" (2026-08) — voir demande utilisateur : le bouton ne
  // faisait auparavant qu'un toast ("Rapport PDF généré") sans rien
  // produire. Génère un VRAI document reprenant exactement les chiffres
  // calculés par pilotage() ci-dessus pour l'année demandée.
  async genererRapportPdf(anneeParam: string | undefined, res: Response): Promise<void> {
    const d = await this.pilotage(anneeParam);
    const p = await this.parametresEntreprise.findOne();
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: `Pilotage Assurance ${d.annee}` } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="Pilotage-Assurance-${d.annee}.pdf"`);
      doc.pipe(res);
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      doc.fontSize(13).font("Helvetica-Bold").fillColor(p.couleurPrimaire).text(p.nom, left, 40);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text("PILOTAGE ASSURANCE", left, 60);
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(`Exercice ${d.annee}`, left, 78);
      doc.fontSize(8).fillColor("#888").text(`Édité le ${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`, left, 92);
      let y = 112;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
      y += 14;

      const carte = (label: string, valeur: string, colX: number, colW: number) => {
        doc.fontSize(8).font("Helvetica").fillColor("#666").text(label, colX, y, { width: colW });
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#000").text(valeur, colX, y + 11, { width: colW });
      };
      const colW = (width - 30) / 4;
      const lignesKpi: [string, string][][] = [
        [["Primes émises (cumulé)", `${fmt(d.primesEmisesCumule)} FCFA`], ["Commissions perçues", `${fmt(d.commissionsPercues)} FCFA`], ["Contrats actifs", `${d.contratsActifs} sur ${d.contratsTotal} (${d.contratsInactifs} inactifs)`], ["Sinistres en cours", `${d.sinistresEnCours} (S/P ${d.sinistresRatioSP}%)`]],
        [["Clients actifs", `${d.clientsActifs} (dont ${d.clientsEntreprises} entreprises)`], ["Taux de recouvrement", d.tauxRecouvrement !== null ? `${d.tauxRecouvrement}%` : "—"], ["Assurés santé", `${d.assuresSante} sur ${d.assuresSanteTotal} (${d.assuresSanteInactifs} inactifs)`], ["Trésorerie", `${fmt(d.tresorerie)} FCFA`]],
      ];
      for (const rangee of lignesKpi) {
        let x = left;
        for (const [label, valeur] of rangee) { carte(label, valeur, x, colW); x += colW + 10; }
        y += 34;
      }
      y += 6;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
      y += 14;

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Production mensuelle", left, y);
      y += 16;
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#666");
      doc.text("Mois", left, y, { width: 40 });
      doc.text(`Primes ${d.annee}`, left + 45, y, { width: 90, align: "right" });
      doc.text(`Primes ${d.annee - 1}`, left + 140, y, { width: 90, align: "right" });
      y += 12;
      doc.font("Helvetica").fillColor("#000");
      for (const ligne of d.productionMensuelle) {
        doc.fontSize(8).text(ligne.mois, left, y, { width: 40 });
        doc.text(fmt(ligne.prime), left + 45, y, { width: 90, align: "right" });
        doc.text(fmt(ligne.primeAnneePrecedente), left + 140, y, { width: 90, align: "right" });
        y += 12;
      }
      y += 10;

      if (d.alertes.length > 0) {
        doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
        y += 14;
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#000").text("Alertes & actions requises", left, y);
        y += 16;
        doc.fontSize(8.5).font("Helvetica");
        for (const a of d.alertes) { doc.text(`•  ${a.message}`, left, y, { width }); y += 13; }
      }

      doc.end();
      doc.on("end", () => resolve());
    });
  }
}

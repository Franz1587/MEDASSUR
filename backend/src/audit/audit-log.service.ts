import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

// Entités "établies" comptabilisées dans la capacité de traitement par
// agent (2026-08) — factures et règlements, voir demande utilisateur :
// "comptabiliser le nombre de facture et règlement établi par un agent...
// savoir la capacité de traitement de chaque agent de saisie". Les valeurs
// correspondent au premier segment de route après /api (voir
// AuditInterceptor), donc au nom du contrôleur Nest concerné.
const ENTITES_PRODUCTION: Record<string, "factures" | "reglements"> = {
  factures: "factures",
  "reglement-prestataire": "reglements",
  "reglement-comptable": "reglements",
};

// Libellés lisibles des entités journalisées — même liste que le
// Combobox "Entité" du frontend (JournalOperationsView), redonnée ici
// pour que l'État global imprimé/téléchargé affiche un nom clair plutôt
// que le nom brut du contrôleur Nest.
const LIBELLES_ENTITES: Record<string, string> = {
  contrats: "Contrats", factures: "Factures", "accord-prealable": "Prises en charge",
  "reglement-prestataire": "Règlement prestataire", "reglement-comptable": "Règlement comptable",
  clients: "Souscripteurs", sante: "Participants santé", avenants: "Avenants",
  renouvellements: "Renouvellements", resiliations: "Résiliations", sinistres: "Sinistres",
  prestataires: "Prestataires", "actes-medicaux": "Catalogue des actes médicaux",
  "lettres-cles": "Lettres clés", devis: "Devis", cotation: "Cotation", "appel-offres": "Appels d'offres",
};

function parseDateFr(s?: string): Date | undefined {
  if (!s) return undefined;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : undefined;
}

type Filtres = { entite?: string; entiteId?: string; utilisateur?: string; action?: string; du?: string; au?: string };

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService, private parametresEntreprise: ParametresEntrepriseService) {}

  // Filtres (2026-08) — entité/dossier précis (widget "dernière
  // modification" sur une fiche), ou recherche libre pour l'écran Journal
  // des opérations (voir demande utilisateur). utilisateurNom résolu ici
  // (pas de vrai catalogue utilisateurs exploitable côté frontend à ce
  // jour, voir admin.service.ts encore mocké) pour éviter d'afficher un
  // email brut dans le journal.
  private async chercherEntries(filtres: Filtres | undefined, limit: number) {
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entite: filtres?.entite,
        entiteId: filtres?.entiteId,
        utilisateur: filtres?.utilisateur,
        action: filtres?.action,
        ...(du || au ? { dateAction: { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) } } : {}),
      },
      orderBy: { dateAction: "desc" },
      take: limit,
    });
    const users = await this.prisma.user.findMany({ select: { email: true, nom: true } });
    const nomParEmail = new Map(users.map((u) => [u.email, u.nom]));
    return logs.map((l) => ({ ...l, utilisateurNom: nomParEmail.get(l.utilisateur) ?? l.utilisateur }));
  }

  findAll(filtres?: Filtres) {
    return this.chercherEntries(filtres, 500);
  }

  log(entite: string, entiteId: string, action: string, utilisateur: string, details?: string) {
    return this.prisma.auditLog.create({
      data: { entite, entiteId, action, utilisateur, details },
    });
  }

  // Widget "dernière modification" (2026-08) — affiché sur la fiche d'un
  // contrat/facture/prise en charge (voir demande utilisateur : "le système
  // doit pouvoir mettre la date de la dernière modification et la personne
  // ayant fait cette modification"). Le plus récent événement TOUT COURT
  // (Créé si rien n'a encore été modifié depuis, sinon la dernière
  // modification réelle) — jamais déclenché par une simple consultation
  // (GET), qui n'est pas journalisée par AuditInterceptor.
  async derniereModification(entite: string, entiteId: string) {
    const dernier = await this.prisma.auditLog.findFirst({ where: { entite, entiteId }, orderBy: { dateAction: "desc" } });
    if (!dernier) return null;
    const utilisateur = await this.prisma.user.findUnique({ where: { email: dernier.utilisateur }, select: { nom: true } });
    return { ...dernier, utilisateurNom: utilisateur?.nom ?? dernier.utilisateur };
  }

  // Capacité de traitement par agent (2026-08) — nombre de factures et de
  // règlements ÉTABLIS (action "Créé" uniquement, pas les modifications)
  // par agent de saisie, pour savoir qui traite combien (voir demande
  // utilisateur).
  async statsParAgent(filtres?: { du?: string; au?: string }) {
    const du = parseDateFr(filtres?.du);
    const au = parseDateFr(filtres?.au);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: "Créé",
        entite: { in: Object.keys(ENTITES_PRODUCTION) },
        ...(du || au ? { dateAction: { ...(du ? { gte: du } : {}), ...(au ? { lte: au } : {}) } } : {}),
      },
      select: { utilisateur: true, entite: true },
    });
    const users = await this.prisma.user.findMany({ select: { email: true, nom: true, roleId: true } });
    const nomParEmail = new Map(users.map((u) => [u.email, u.nom]));
    const stats = new Map<string, { utilisateur: string; nom: string; factures: number; reglements: number; total: number }>();
    for (const l of logs) {
      const cle = ENTITES_PRODUCTION[l.entite];
      if (!cle) continue;
      if (!stats.has(l.utilisateur)) {
        stats.set(l.utilisateur, { utilisateur: l.utilisateur, nom: nomParEmail.get(l.utilisateur) ?? l.utilisateur, factures: 0, reglements: 0, total: 0 });
      }
      const s = stats.get(l.utilisateur)!;
      s[cle]++;
      s.total++;
    }
    return [...stats.values()].sort((a, b) => b.total - a.total);
  }

  // ══════════════════════════════════════════════════════════════════
  // État global — édition/téléchargement/impression (2026-08) — voir
  // demande utilisateur : "pour le journal des opérations, on doit pouvoir
  // en éditer, télécharger et imprimer un état global, par type d'action,
  // par date, mais aussi par agents." Reprend EXACTEMENT les mêmes filtres
  // que l'écran de recherche (voir chercherEntries), sans la limite à 500
  // lignes de l'affichage à l'écran (un état global doit couvrir toute la
  // période demandée) — plafonné à 5000 lignes pour rester générable en un
  // temps raisonnable.
  // ══════════════════════════════════════════════════════════════════
  private libelleFiltres(filtres: Filtres, nomAgent?: string): string {
    const morceaux: string[] = [];
    morceaux.push(filtres.du && filtres.au ? `Période du ${filtres.du} au ${filtres.au}` : filtres.du ? `À partir du ${filtres.du}` : filtres.au ? `Jusqu'au ${filtres.au}` : "Toute période");
    if (filtres.entite) morceaux.push(`Entité : ${LIBELLES_ENTITES[filtres.entite] ?? filtres.entite}`);
    if (filtres.action) morceaux.push(`Action : ${filtres.action}`);
    if (filtres.utilisateur) morceaux.push(`Agent : ${nomAgent ?? filtres.utilisateur}`);
    return morceaux.join("  ·  ");
  }

  async genererEtatGlobal(filtres: Filtres, format: "pdf" | "xlsx", res: Response) {
    const entries = await this.chercherEntries(filtres, 5000);
    const nomAgent = filtres.utilisateur ? entries[0]?.utilisateurNom : undefined;
    const periodeTxt = this.libelleFiltres(filtres, nomAgent);
    const p = await this.parametresEntreprise.findOne();

    // Synthèse (2026-08) — répartition par action et par agent, pour que
    // "l'état global" soit vraiment un état de synthèse et pas seulement
    // un export brut de la liste déjà visible à l'écran.
    const parAction = new Map<string, number>();
    const parAgent = new Map<string, number>();
    for (const e of entries) {
      parAction.set(e.action, (parAction.get(e.action) ?? 0) + 1);
      parAgent.set(e.utilisateurNom, (parAgent.get(e.utilisateurNom) ?? 0) + 1);
    }
    const syntheseAgents = [...parAgent.entries()].sort((a, b) => b[1] - a[1]);

    if (format === "xlsx") return this.genererEtatGlobalXlsx(entries, periodeTxt, parAction, syntheseAgents, res);
    return this.genererEtatGlobalPdf(entries, periodeTxt, parAction, syntheseAgents, p.nom, p.couleurPrimaire, res);
  }

  private async genererEtatGlobalXlsx(
    entries: Awaited<ReturnType<AuditLogService["chercherEntries"]>>, periodeTxt: string,
    parAction: Map<string, number>, syntheseAgents: [string, number][], res: Response,
  ) {
    const classeur = new ExcelJS.Workbook();
    const synthese = classeur.addWorksheet("Synthèse");
    synthese.columns = [{ key: "libelle", width: 32 }, { key: "valeur", width: 16 }];
    synthese.addRow(["État global du journal des opérations"]).font = { bold: true, size: 13 };
    synthese.addRow([periodeTxt]);
    synthese.addRow([]);
    synthese.addRow(["Total des opérations", entries.length]).font = { bold: true };
    synthese.addRow([]);
    synthese.addRow(["Par action"]).font = { bold: true };
    for (const [action, n] of parAction) synthese.addRow([action, n]);
    synthese.addRow([]);
    synthese.addRow(["Par agent"]).font = { bold: true };
    for (const [agent, n] of syntheseAgents) synthese.addRow([agent, n]);

    const detail = classeur.addWorksheet("Détail");
    detail.columns = [
      { header: "Date", key: "date", width: 18 }, { header: "Agent", key: "agent", width: 22 },
      { header: "Entité", key: "entite", width: 22 }, { header: "Dossier", key: "dossier", width: 20 },
      { header: "Action", key: "action", width: 14 }, { header: "Détails", key: "details", width: 40 },
    ];
    detail.getRow(1).font = { bold: true };
    for (const e of entries) {
      detail.addRow({
        date: new Date(e.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
        agent: e.utilisateurNom, entite: LIBELLES_ENTITES[e.entite] ?? e.entite, dossier: e.entiteId,
        action: e.action, details: e.details ?? "",
      });
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="etat-global-journal-operations.xlsx"');
    await classeur.xlsx.write(res);
    res.end();
  }

  private genererEtatGlobalPdf(
    entries: Awaited<ReturnType<AuditLogService["chercherEntries"]>>, periodeTxt: string,
    parAction: Map<string, number>, syntheseAgents: [string, number][], nomEntreprise: string, couleurPrimaire: string, res: Response,
  ): Promise<void> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, info: { Title: "État global du journal des opérations" } });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="etat-global-journal-operations.pdf"');
      doc.pipe(res);
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const width = right - left;

      doc.fontSize(13).font("Helvetica-Bold").fillColor(couleurPrimaire).text(nomEntreprise, left, 40);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text("ÉTAT GLOBAL DU JOURNAL DES OPÉRATIONS", left, 60);
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(periodeTxt, left, 78);
      doc.fontSize(8).fillColor("#888").text(`Édité le ${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`, left, 92);

      let y = 112;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
      y += 10;
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#000").text(`Total : ${entries.length} opération(s)`, left, y);
      y += 14;
      const actionsTxt = [...parAction.entries()].map(([a, n]) => `${a} : ${n}`).join("   ·   ");
      doc.fontSize(8.5).font("Helvetica").fillColor("#333").text(actionsTxt, left, y, { width });
      y += 14;
      const agentsTxt = syntheseAgents.slice(0, 6).map(([a, n]) => `${a} (${n})`).join("   ·   ");
      if (agentsTxt) { doc.fontSize(8.5).text(`Agents : ${agentsTxt}${syntheseAgents.length > 6 ? "…" : ""}`, left, y, { width }); y += 14; }
      y += 6;
      doc.moveTo(left, y).lineTo(right, y).strokeColor("#ccc").stroke();
      y += 10;

      // Table (2026-08) — colonnes à largeur fixe, en-tête répété sur
      // chaque nouvelle page (voir doc.on("pageAdded"), même principe que
      // les autres exports tabulaires de l'application).
      const colonnes: { label: string; width: number }[] = [
        { label: "Date", width: 78 }, { label: "Agent", width: 90 }, { label: "Entité", width: 90 },
        { label: "Dossier", width: 90 }, { label: "Action", width: 60 }, { label: "Détails", width: width - 78 - 90 - 90 - 90 - 60 },
      ];
      const dessinerEnTeteColonnes = (yy: number) => {
        doc.rect(left, yy, width, 16).fill(couleurPrimaire);
        doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
        let x = left;
        for (const c of colonnes) { doc.text(c.label, x + 3, yy + 4, { width: c.width - 6 }); x += c.width; }
        doc.fillColor("#000");
        return yy + 16;
      };
      y = dessinerEnTeteColonnes(y);
      doc.font("Helvetica").fontSize(7.5);
      for (const e of entries) {
        const valeurs = [
          new Date(e.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
          e.utilisateurNom, LIBELLES_ENTITES[e.entite] ?? e.entite, e.entiteId, e.action, e.details ?? "",
        ];
        const hauteur = Math.max(12, ...valeurs.map((v, i) => doc.heightOfString(v, { width: colonnes[i].width - 6 })));
        if (y + hauteur > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = 40;
          y = dessinerEnTeteColonnes(y);
          doc.font("Helvetica").fontSize(7.5).fillColor("#000");
        }
        let x = left;
        for (let i = 0; i < colonnes.length; i++) {
          doc.fillColor("#000").text(valeurs[i], x + 3, y + 2, { width: colonnes[i].width - 6 });
          x += colonnes[i].width;
        }
        y += hauteur + 4;
        doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor("#eee").stroke();
      }
      doc.end();
      doc.on("end", () => resolve());
    });
  }
}

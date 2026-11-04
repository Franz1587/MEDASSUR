import * as path from "path";
import type { Response } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { AlignmentType, Document, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, ShadingType } from "docx";
import type { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";

// Export d'un tableau en Excel, CSV, PDF ou Word à partir d'une seule description.
export type FormatExport = "xlsx" | "csv" | "pdf" | "docx";
export type Cellule = string | number | null | undefined;
export interface ColonneExport { titre: string; type?: "texte" | "montant" | "nombre"; largeur?: number }
export interface TableauExport {
  titre: string;
  sousTitre?: string;
  societe?: string;
  colonnes: ColonneExport[];
  lignes: Cellule[][];
  total?: boolean;
  nomFichier: string; // sans extension
}

export function formatExport(v?: string): FormatExport {
  return v === "csv" || v === "pdf" || v === "docx" ? v : "xlsx";
}

export async function nomSocieteCourante(prisma: PrismaService): Promise<string | undefined> {
  const id = TenantContext.getSocieteId();
  if (!id) return undefined;
  const p = await prisma.parametresEntreprise.findUnique({ where: { id }, select: { nom: true } });
  return p?.nom;
}

// PDF/Word au-delà de ce nombre de lignes : illisibles et très lourds → Excel/CSV.
const LIMITE_DOCUMENT = 10000;
const ASSETS = path.join(process.cwd(), "assets", "offre-sante");

const estChiffre = (c: ColonneExport) => c.type === "montant" || c.type === "nombre";
const montantFr = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
function texte(v: Cellule, c: ColonneExport): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && estChiffre(c)) return c.type === "montant" ? montantFr(v) : String(v);
  return String(v);
}

function ligneTotal(t: TableauExport): Cellule[] | null {
  if (!t.total || !t.lignes.length) return null;
  return t.colonnes.map((c, i) => {
    if (i === 0) return "TOTAL";
    if (c.type !== "montant") return null;
    return t.lignes.reduce((s, l) => s + (typeof l[i] === "number" ? (l[i] as number) : 0), 0);
  });
}

async function versXlsx(t: TableauExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.titre.slice(0, 31).replace(/[\\/*?:[\]]/g, " "));
  const n = t.colonnes.length;
  ws.addRow([t.societe ? `${t.societe} — ${t.titre}` : t.titre]).font = { bold: true, size: 14 };
  ws.mergeCells(1, 1, 1, n);
  ws.addRow([t.sousTitre ?? ""]).font = { italic: true, color: { argb: "FF555555" } };
  ws.mergeCells(2, 1, 2, n);
  ws.addRow([]);
  const entete = ws.addRow(t.colonnes.map((c) => c.titre));
  entete.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C81" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  for (const l of t.lignes) ws.addRow(l.map((v) => (v === undefined ? null : v)));
  const total = ligneTotal(t);
  if (total) ws.addRow(total).font = { bold: true };
  t.colonnes.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(48, Math.max(10, c.titre.length + 2, ...t.lignes.slice(0, 300).map((l) => texte(l[i], c).length + 2)));
    if (c.type === "montant") col.numFmt = "#,##0";
    if (estChiffre(c)) col.alignment = { horizontal: "right" };
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
  ws.views = [{ state: "frozen", ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function versCsv(t: TableauExport): Buffer {
  const echapper = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lignes = [t.colonnes.map((c) => c.titre), ...t.lignes.map((l) => l.map((v) => (v === null || v === undefined ? "" : String(v))))];
  const total = ligneTotal(t);
  if (total) lignes.push(total.map((v) => (v === null ? "" : String(v))));
  // BOM UTF-8 : Excel lit correctement les accents.
  return Buffer.from(`﻿${lignes.map((l) => l.map(echapper).join(";")).join("\r\n")}`, "utf8");
}

function versPdf(t: TableauExport): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, bufferPages: true, info: { Title: t.titre } });
    const morceaux: Buffer[] = [];
    doc.on("data", (b: Buffer) => morceaux.push(b));
    doc.on("end", () => resoudre(Buffer.concat(morceaux)));
    doc.on("error", rejeter);
    doc.registerFont("R", path.join(ASSETS, "Carlito-Regular.ttf"));
    doc.registerFont("B", path.join(ASSETS, "Carlito-Bold.ttf"));

    const gauche = doc.page.margins.left;
    const largeurUtile = doc.page.width - gauche - doc.page.margins.right;
    const poids = t.colonnes.map((c) => c.largeur ?? (c.type === "montant" ? 1.45 : c.type === "nombre" ? 0.7 : 1.3));
    const somme = poids.reduce((a, b) => a + b, 0);
    const largeurs = poids.map((p) => (p / somme) * largeurUtile);
    const tailleTexte = t.colonnes.length > 12 ? 6.5 : t.colonnes.length > 8 ? 7.5 : 8.5;
    const hauteur = tailleTexte + 7;

    doc.font("B").fontSize(14).fillColor("#0f4c81").text(t.societe ? `${t.societe} — ${t.titre}` : t.titre, gauche, doc.y);
    if (t.sousTitre) doc.font("R").fontSize(9).fillColor("#555555").text(t.sousTitre);
    doc.moveDown(0.6);

    // Position verticale tenue ici : doc.text() avance doc.y et doublerait l'interligne.
    const hauteurEntete = hauteur * 2;
    const bas = doc.page.height - doc.page.margins.bottom - 14;
    let y = doc.y;
    const dessinerLigne = (cellules: string[], style: "entete" | "corps" | "total", fond?: string) => {
      const h = style === "entete" ? hauteurEntete : hauteur;
      if (fond) doc.rect(gauche, y, largeurUtile, h).fill(fond);
      let x = gauche;
      cellules.forEach((s, i) => {
        doc.font(style === "corps" ? "R" : "B").fontSize(tailleTexte).fillColor(style === "entete" ? "#ffffff" : "#1a1a2e")
          .text(s, x + 2, y + 3.5, {
            width: largeurs[i] - 4, height: h - 3, align: estChiffre(t.colonnes[i]) && style !== "entete" ? "right" : "left",
            lineBreak: style === "entete", ellipsis: true,
          });
        x += largeurs[i];
      });
      y += h;
    };
    const entete = () => dessinerLigne(t.colonnes.map((c) => c.titre), "entete", "#0f4c81");
    const sautSiBesoin = () => { if (y + hauteur > bas) { doc.addPage(); y = doc.page.margins.top; entete(); } };

    entete();
    t.lignes.slice(0, LIMITE_DOCUMENT).forEach((l, i) => {
      sautSiBesoin();
      dessinerLigne(l.map((v, j) => texte(v, t.colonnes[j])), "corps", i % 2 ? "#f3f6fa" : undefined);
    });
    const total = ligneTotal(t);
    if (total) {
      sautSiBesoin();
      dessinerLigne(total.map((v, j) => texte(v, t.colonnes[j])), "total", "#e3ebf5");
    }
    if (t.lignes.length > LIMITE_DOCUMENT) {
      doc.font("B").fontSize(9).fillColor("#b45309").text(`${t.lignes.length - LIMITE_DOCUMENT} lignes supplémentaires non affichées : utilisez l'export Excel ou CSV pour la totalité.`, gauche, y + 6);
    }
    const pages = doc.bufferedPageRange();
    const edition = `Édité le ${new Date().toLocaleDateString("fr-FR")}`;
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // sinon pdfkit ouvre une page blanche pour ce pied de page
      doc.font("R").fontSize(7.5).fillColor("#6b7280").text(`${edition} — page ${i + 1} / ${pages.count}`, gauche, doc.page.height - 20, { width: largeurUtile, align: "left", lineBreak: false }); // à gauche : le QR de signature occupe le coin droit
    }
    doc.end();
  });
}

async function versDocx(t: TableauExport): Promise<Buffer> {
  const taille = t.colonnes.length > 10 ? 13 : 16; // demi-points
  const cellule = (s: string, opts: { gras?: boolean; droite?: boolean; fond?: string; blanc?: boolean }) =>
    new TableCell({
      shading: opts.fond ? { type: ShadingType.CLEAR, fill: opts.fond, color: "auto" } : undefined,
      children: [new Paragraph({ alignment: opts.droite ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: s, bold: opts.gras, size: taille, color: opts.blanc ? "FFFFFF" : undefined, font: "Calibri" })] })],
    });
  const total = ligneTotal(t);
  const lignes = t.lignes.slice(0, LIMITE_DOCUMENT);
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: t.colonnes.map((c) => cellule(c.titre, { gras: true, fond: "0F4C81", blanc: true })) }),
      ...lignes.map((l) => new TableRow({ children: l.map((v, j) => cellule(texte(v, t.colonnes[j]), { droite: estChiffre(t.colonnes[j]) })) })),
      ...(total ? [new TableRow({ children: total.map((v, j) => cellule(texte(v, t.colonnes[j]), { gras: true, droite: estChiffre(t.colonnes[j]), fond: "E3EBF5" })) })] : []),
    ],
  });
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 600, bottom: 600, left: 500, right: 500 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: t.societe ? `${t.societe} — ${t.titre}` : t.titre, bold: true, size: 28, color: "0F4C81", font: "Calibri" })] }),
        ...(t.sousTitre ? [new Paragraph({ children: [new TextRun({ text: t.sousTitre, italics: true, size: 18, color: "555555", font: "Calibri" })] })] : []),
        new Paragraph({ text: "" }),
        table,
        ...(t.lignes.length > LIMITE_DOCUMENT ? [new Paragraph({ children: [new TextRun({ text: `${t.lignes.length - LIMITE_DOCUMENT} lignes supplémentaires non affichées : utilisez l'export Excel ou CSV.`, bold: true, color: "B45309" })] })] : []),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

const MIME: Record<FormatExport, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function genererExport(format: FormatExport, t: TableauExport): Promise<Buffer> {
  if (format === "csv") return versCsv(t);
  if (format === "pdf") return versPdf(t);
  if (format === "docx") return versDocx(t);
  return versXlsx(t);
}

export async function envoyerExport(res: Response, format: FormatExport, t: TableauExport) {
  const contenu = await genererExport(format, t);
  // En-tête HTTP en ASCII (accents retirés) : un caractère hors Latin-1 y ferait échouer l'envoi.
  const nom = `${t.nomFichier.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_")}.${format}`;
  res.setHeader("Content-Type", MIME[format]);
  res.setHeader("Content-Disposition", `${format === "pdf" ? "inline" : "attachment"}; filename="${nom}"`);
  res.send(contenu);
}

import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLib, StandardFonts, rgb } from "pdf-lib";
import type { ContenuOffre, LimiteGarantie, ParametresOffre, SectionGaranties, TableauGaranties } from "../cotation/contenu-offre";
import sharp from "sharp";

// Offre santé — copie du modèle Word de LA RUCHE (OFFRE SANTE LAY PRO.pdf,
// la plus récente des trois offres de référence ; BW ENERGY et ETS MSSZ
// suivent la même maquette). Toutes les cotes en pt sont relevées sur ce
// PDF avec PyMuPDF (haut de boîte de texte = « top », comme dans le relevé) :
// retoucher une cote = re-mesurer sur le modèle, jamais à l'œil.
// Polices : Times du PDF (métriques identiques à Times New Roman, aucune
// police Microsoft embarquée), Carlito (métriques Calibri) pour le tableau
// de décompte. L'annexe réseau est le PDF officiel Réseau de Soins.

type Doc = InstanceType<typeof PDFDocument>;
export type ImageSrc = Buffer | string;

const ASSETS = path.join(process.cwd(), "assets", "offre-sante");
const TR = "Times-Roman", TB = "Times-Bold", TBI = "Times-BoldItalic";
const CA = "Carlito", CAB = "Carlito-Bold";
// Ascendant Times New Roman / Calibri / Arial : top de boîte → ligne de base.
const ASC: Record<string, number> = { [TR]: 0.891, [TB]: 0.891, [TBI]: 0.891, [CA]: 0.75, [CAB]: 0.75 };
const MARINE = "#000080";
const PAGE_W = 596.52, PAGE_H = 842.52;
// Marge droite du texte courant (coupures identiques au modèle Word).
const MARGE_DROITE = 557;

export interface CotationOffre {
  branche: string;
  contenu: ContenuOffre;
  primeNette: number;
  cartes: number;
  accessoires: number;
  taxe: number;
  ttc: number;
  tauxTaxe: number;
}

export interface CompagnieOffre {
  nom: string;
  logo: ImageSrc | null;
  logoPetit: ImageSrc | null;
  // Taille du logo sur l'intercalaire relevée dans le modèle (logos
  // fournis avec l'application) ; à défaut, ajusté dans 300 × 145.
  tailleLogo?: [number, number] | null;
  cotations: CotationOffre[];
}

export interface DonneesOffre {
  clientNom: string;
  clientLogo: ImageSrc | null;
  societeLogo: ImageSrc | null;
  params: ParametresOffre;
  compagnies: CompagnieOffre[];
}

// ── Primitives ─────────────────────────────────────────────────────────

// Les polices standard du PDF ne couvrent que WinAnsi : tout autre
// caractère (espace fine insécable, flèches…) est ramené à un équivalent.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function winAnsi(s: string): string {
  return s
    .replace(/[   ]/g, " ")
    .replace(/[≤]/g, "<=").replace(/[≥]/g, ">=").replace(/[→⇒]/g, "->").replace(/[‐‑‒]/g, "-")
    .replace(/[^\x20-\x7e -ÿ]/g, (c) => (WINANSI_EXTRA.includes(c) ? c : ""));
}

interface Style { f: string; s: number; c?: string }

function largeur(doc: Doc, s: string, st: Style): number {
  return doc.font(st.f).fontSize(st.s).widthOfString(st.f.startsWith("Carlito") ? s : winAnsi(s));
}

// Texte posé par le haut de sa boîte (« top » du relevé PyMuPDF).
// a = "g" gauche (x = bord gauche), "c" centré (x = centre), "d" droite.
function t(doc: Doc, s: string, x: number, top: number, st: Style, a: "g" | "c" | "d" = "g", souligne = false): number {
  const txt = st.f.startsWith("Carlito") ? s : winAnsi(s);
  const w = largeur(doc, txt, st);
  const xx = a === "g" ? x : a === "c" ? x - w / 2 : x - w;
  doc.font(st.f).fontSize(st.s).fillColor(st.c ?? "#000")
    .text(txt, xx, top + ASC[st.f] * st.s, { lineBreak: false, baseline: "alphabetic" });
  if (souligne) doc.rect(xx, top + 0.92 * st.s, w, 0.13 * st.s).fill(st.c ?? "#000");
  return w;
}

function couper(doc: Doc, s: string, st: Style, max: number): string[] {
  const lignes: string[] = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      const essai = cur ? `${cur} ${mot}` : mot;
      if (cur && largeur(doc, essai, st) > max) { lignes.push(cur); cur = mot; } else cur = essai;
    }
    lignes.push(cur);
  }
  return lignes;
}

function ligneH(doc: Doc, x0: number, x1: number, y: number, c = "#000", e = 0.48) { doc.rect(x0, y, x1 - x0, e).fill(c); }
function ligneV(doc: Doc, x: number, y0: number, y1: number, c = "#000", e = 0.48) { doc.rect(x, y0, e, y1 - y0).fill(c); }

// PDFKit ne met en cache que les images données par chemin : un logo passé
// en Buffer était réembarqué à chaque page (26 copies = plusieurs Mo).
// openImage existe dans PDFKit mais n'est pas déclaré par @types/pdfkit.
type AvecOpenImage = { openImage(src: ImageSrc): unknown };
const imagesOuvertes = new WeakMap<Doc, Map<ImageSrc, unknown>>();
function image(doc: Doc, img: ImageSrc | null, x: number, y: number, w: number, h: number) {
  if (!img) return;
  try {
    let cache = imagesOuvertes.get(doc);
    if (!cache) imagesOuvertes.set(doc, (cache = new Map()));
    let ouverte = cache.get(img);
    if (!ouverte) cache.set(img, (ouverte = (doc as unknown as AvecOpenImage).openImage(img)));
    doc.image(ouverte as ImageSrc, x, y, { fit: [w, h], align: "center", valign: "center" });
  } catch { /* image illisible : jamais bloquant */ }
}

// Puce ➢ : glyphe 190 de la police Wingdings embarquée dans le modèle
// (unités 2048/em), redessiné en vectoriel à la taille du texte.
function fleche(doc: Doc, x: number, top: number, s = 12) {
  const k = s / 2048, b = top + ASC[TR] * s;
  const p = (u: number, v: number) => `${(x + u * k).toFixed(2)} ${(b - v * k).toFixed(2)}`;
  doc.path(`M${p(173, 0)} L${p(1455, 740)} L${p(173, 1480)} L${p(601, 740)} Z M${p(1357, 740)} L${p(658, 740)} L${p(308, 1346)} Z`).fill("#000");
}

// Puce « • » de la police Symbol (12 pt), plus grosse que celle de Times.
function rond(doc: Doc, x: number, top: number) { doc.circle(x + 2.76, top + 7.0, 2.05).fill("#000"); }

const fmtEsp =(n: number) => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const fmtPts = (n: number) => Math.round(n).toLocaleString("fr-FR").replace(/[  \s]/g, ".");

function numeroPage(doc: Doc, n: number) { t(doc, String(n), 559.3, 794.6, { f: TR, s: 11.04 }, "d"); }

// Bandeau d'en-tête à trois cases (logo société | titre | logo client).
interface Bandeau { x: [number, number, number, number]; y: [number, number]; logoSoc: [number, number, number, number]; logoCli: [number, number, number, number] }
function bandeau(doc: Doc, b: Bandeau, d: DonneesOffre, titre: string[], tops: number[], centre: number, taille = 14.04) {
  const [x0, x1, x2, x3] = b.x, [y0, y1] = b.y;
  ligneH(doc, x0, x3 + 0.48, y0, MARINE); ligneH(doc, x0, x3 + 0.48, y1, MARINE);
  for (const x of [x0, x1, x2, x3]) ligneV(doc, x, y0, y1, MARINE);
  image(doc, d.societeLogo, ...b.logoSoc);
  image(doc, d.clientLogo, ...b.logoCli);
  titre.forEach((l, i) => t(doc, l, centre, tops[i], { f: TB, s: taille }, "c"));
}

// ── Couverture ─────────────────────────────────────────────────────────

function pageCouverture(doc: Doc, d: DonneesOffre) {
  image(doc, d.societeLogo, 63.35, 48.65, 154.99, 66.3);
  doc.rect(83.65, 141.45, 428.75, 0.5).fill(MARINE);
  const titre: Style = { f: TB, s: 27.96 };
  t(doc, d.params.titreDocument, 295.0, 195.79, titre, "c");
  const nom = `« ${d.clientNom} »`;
  const st = largeur(doc, nom, titre) > 470 ? { ...titre, s: 27.96 * 470 / largeur(doc, nom, titre) } : titre;
  t(doc, nom, 314.8, 287.02, st, "c");
  image(doc, d.clientLogo, 170.47, 361.84, 265.2, 176.85);
  const lab: Style = { f: TB, s: 11.04 };
  const lignes: [string, string[]][] = [
    ["Rédacteur", d.params.redacteur],
    ["Date", [d.params.date]],
    ["Chargée clientèle", [d.params.chargeClientele]],
    ["Téléphone", [d.params.telephone]],
    ["Télécopie", [d.params.telecopie]],
  ];
  let top = 700.66;
  for (const [l, vals] of lignes) {
    t(doc, l, 78.74, top, lab, "g", true);
    t(doc, ":", 184.97, top, lab);
    vals.forEach((v, i) => { t(doc, v, i === 0 ? 220.37 : 223.85, top, lab); if (i < vals.length - 1) top += 12.6; });
    top += 12.6;
  }
}

// ── Récapitulatif des primes ───────────────────────────────────────────

const RX = [63.6, 127.3, 410.9, 531.2];

const B12: Style = { f: TB, s: 12 };
// Désignation coupée à la largeur de sa colonne (territorialités longues).
const designation = (doc: Doc, l: CotationOffre) => l.contenu.designationRecap.flatMap((s) => couper(doc, s, B12, RX[2] - RX[1] - 10));
const hauteurLigneRecap = (doc: Doc, l: CotationOffre) => 14.3 + 13.8 * Math.max(1, designation(doc, l).length);

function blocRecap(doc: Doc, c: CompagnieOffre, y: number): number {
  const [x0, x1, x2, x3] = RX;
  const b12 = B12;
  const lignes = [...c.cotations];
  const hLignes = lignes.map((l) => hauteurLigneRecap(doc, l));
  const yPar = y + 28.3, yItems = yPar + 29.2;
  const yTotal = yItems + hLignes.reduce((a, h) => a + h, 0), yFin = yTotal + 20.6;
  // Grille
  for (const yy of [y, yPar, yItems, yFin]) ligneH(doc, x0, x3 + 0.48, yy);
  let yy = yItems;
  for (const h of hLignes) { yy += h; ligneH(doc, x0, x3 + 0.48, yy); }
  ligneV(doc, x0, y, yFin); ligneV(doc, x3, y, yFin); ligneV(doc, x2, y, yFin);
  ligneV(doc, x1, y, yPar); ligneV(doc, x1, yItems, yFin);
  // En-tête
  t(doc, "N°", (x0 + x1) / 2, y + 0.9, b12, "c"); t(doc, "D’ORDRE", (x0 + x1) / 2, y + 14.7, b12, "c");
  t(doc, "DESIGNATION", (x1 + x2) / 2, y + 0.8, b12, "c");
  t(doc, "PRIME TTC", (x2 + x3) / 2, y + 0.9, b12, "c"); t(doc, "F.CFA", (x2 + x3) / 2, y + 14.7, b12, "c");
  t(doc, "RECAPITULATIF DES ASSURANCES PROPOSEES PAR", 73.6, yPar + 12.1, { f: TB, s: 11.04 });
  image(doc, c.logoPetit ?? c.logo, x2 + 8, yPar + 0.6, x3 - x2 - 16, 28);
  // Lignes
  yy = yItems;
  let total = 0, nonCommunique = false;
  lignes.forEach((l, i) => {
    t(doc, String(i + 1), (x0 + x1) / 2, yy + 0.8, b12, "c");
    designation(doc, l).forEach((s, k) => t(doc, s, (x1 + x2) / 2, yy + 0.9 + 13.8 * k, b12, "c"));
    if (l.contenu.primeNonCommuniquee) { nonCommunique = true; t(doc, "Non communiqué", (x2 + x3) / 2, yy + 0.9, b12, "c"); }
    else { total += l.ttc; t(doc, fmtEsp(l.ttc), (x2 + x3) / 2, yy + 0.9, { f: TB, s: 11.52 }, "c"); }
    yy += hLignes[i];
  });
  const rouge: Style = { f: TBI, s: 12, c: "#c00000" };
  t(doc, "Total Budget Assurances", (x1 + x2) / 2, yTotal + 0.9, rouge, "c");
  t(doc, nonCommunique && total === 0 ? "Non communiqué" : fmtEsp(total), (x2 + x3) / 2, yTotal + 0.9, rouge, "c");
  return yFin;
}

function pagesRecap(doc: Doc, d: DonneesOffre) {
  doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
  bandeau(doc, { x: [38.6, 202.0, 439.4, 567.1], y: [38.8, 107.2], logoSoc: [52.0, 43.6, 84.6, 40.9], logoCli: [449.5, 51.0, 107, 45] },
    d, ["RECAPITULATIF", "DES PRIMES", d.params.exercice], [53.7, 69.8, 85.9], 320.9);
  let y = 118.1;
  for (const c of d.compagnies) {
    const h = 28.3 + 29.2 + c.cotations.reduce((a, l) => a + hauteurLigneRecap(doc, l), 0) + 20.6;
    if (y + h > 790) { doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 }); y = 70.8; }
    y = blocRecap(doc, c, y) + 18.2;
  }
  // Formule d'acceptation et signatures
  let top = y - 18.2 + 15;
  if (top + 75 > 800) { doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 }); top = 70; }
  const p14: Style = { f: TR, s: 14.04 }, b14: Style = { f: TB, s: 14.04 };
  t(doc, "Si ces propositions retiennent votre attention, nous vous remercions de bien vouloir nous", 49.7, top, p14);
  const w = t(doc, "confirmer votre accord, par une signature précédée de la mention “", 49.7, top + 16.1, p14);
  t(doc, "BON POUR", 49.7 + w, top + 16.1, b14);
  t(doc, "ACCORD’’.", 49.7, top + 32.1, b14);
  t(doc, "LE PROPOSANT", 70.6, top + 59.7, b14, "g", true);
  t(doc, d.params.mentionSignature, 556.7, top + 59.7, b14, "d", true);
}

// ── Intercalaire compagnie ────────────────────────────────────────────

function pageIntercalaire(doc: Doc, d: DonneesOffre, c: CompagnieOffre) {
  const titre = couper(doc, `PROPOSITIONS ${c.nom.toUpperCase()}`, { f: TB, s: 14.04 }, 225);
  bandeau(doc, { x: [56.06, 169.49, 406.9, 534.6], y: [39.72, 108.62], logoSoc: [69.4, 44.57, 84.67, 40.9], logoCli: [416.9, 51.0, 107.7, 47] },
    d, titre, titre.map((_, i) => 54.69 + 16.1 * i), 288.4);
  t(doc, "PROPOSITIONS", 301.4, 293.26, { f: TB, s: 27.96 }, "c");
  const [w, h] = c.tailleLogo ?? [300, 145];
  image(doc, c.logo ?? c.logoPetit, 295.5 - w / 2, 346.5 + (145 - h) / 2 + (h < 100 ? -19 : 0), w, h);
}

// ── Page proposition (Maladie ou Assistance) ──────────────────────────

function infosAssure(doc: Doc, d: DonneesOffre, x: number, xDeux: number, top: number, regle: [number, number, number]) {
  const p12: Style = { f: TR, s: 12 };
  t(doc, "Nom de l’assuré", x, top, p12); t(doc, ":", xDeux, top, p12);
  t(doc, d.clientNom, xDeux + 6.36, top - 1.82, { f: TB, s: 14.04 });
  t(doc, "Adresse de l’assuré", x, top + 14.76, p12); t(doc, `: ${d.params.adresseAssure}`, xDeux, top + 14.76, p12);
  t(doc, "Période de garantie", x, top + 28.56, p12); t(doc, `: ${d.params.periode}`, xDeux, top + 28.56, p12);
  t(doc, "Durée", x, top + 42.84, p12); t(doc, `: ${d.params.duree}`, xDeux, top + 42.84, p12);
  doc.rect(regle[0], regle[2], regle[1] - regle[0], 1.45).fill(MARINE);
}

function listePuces(doc: Doc, items: string[], xPuce: number, xTexte: number, top: number, pas: number, puce: "fleche" | "rond"): number {
  const p12: Style = { f: TR, s: 12 };
  for (const it of items) {
    if (puce === "fleche") fleche(doc, xPuce, top - 0.1); else rond(doc, xPuce, top);
    for (const l of couper(doc, it, p12, MARGE_DROITE - xTexte)) { t(doc, l, xTexte, top, p12); top += pas; }
  }
  return top;
}

function pageProposition(doc: Doc, d: DonneesOffre, cot: CotationOffre) {
  const c = cot.contenu;
  const maladie = cot.branche !== "Assistance";
  const titre = (c.titre.length ? c.titre : maladie ? ["PROPOSITION SANTE"] : ["PROPOSITION", "ASSISTANCE"])
    .flatMap((l) => couper(doc, l, { f: TB, s: 14.04 }, 262));
  // Au-delà de 4 lignes, le titre est réduit pour tenir dans le bandeau.
  const k = Math.min(1, 4 / titre.length), pas = 16.32 * k;
  const hTitre = pas * titre.length;
  bandeau(doc, { x: [69.14, 175.49, 444.94, 565.44], y: [57.0, 136.0], logoSoc: [82.55, 61.52, 84.67, 40.9], logoCli: [455.4, 71.08, 104, 40.9] },
    d, titre, titre.map((_, i) => Math.max(71.49 - (1 - k) * 12, 96.5 - hTitre / 2) + pas * i), 312.6, 14.04 * k);
  infosAssure(doc, d, 70.82, 177.17, 138.85, [69.45, 533.05, 195.27]);
  const b12: Style = { f: TB, s: 12 };
  t(doc, `Population : ${c.population} personnes`, 70.82, 211.33, b12, "g", true);
  t(doc, maladie ? "Garanties :" : "Garanties", 70.82, 248.17, b12, "g", true);
  let top = listePuces(doc, c.garanties, 88.82, 106.82, 275.8, maladie ? 13.8 : 14.65, maladie ? "fleche" : "rond");
  if (maladie && c.limites.length) {
    top += 13.8;
    t(doc, "Limite de garantie", 70.82, top, b12, "g", true);
    top += 27.6;
    top = listeLimites(doc, c.limites, top);
  }
  if (maladie && c.mentionsFraisReels) {
    top += 14.64;
    for (const m of ["FRAIS REELS : FRAIS EXPOSES CONFORMEMENT A LA TARIFICATION\nREGLEMENTAIRE ET/OU CONVENTIONNEE   EN VIGUEUR", "BTAM : BAREME TARIFAIRE DES ACTES MEDICAUX"]) {
      rond(doc, 51.96, top);
      for (const l of m.split("\n")) { t(doc, l, 69.98, top, b12); top += 13.8; }
      top += 14.67;
    }
  }
}

function listeLimites(doc: Doc, limites: LimiteGarantie[], top: number): number {
  const p12: Style = { f: TR, s: 12 };
  for (const lim of limites) {
    fleche(doc, 109.1, top - 0.1);
    for (const l of couper(doc, lim.texte, p12, MARGE_DROITE - 127.22)) { t(doc, l, 127.22, top, p12); top += 13.8; }
    if (lim.detail) for (const l of couper(doc, lim.detail, p12, MARGE_DROITE - 127.1)) { t(doc, l, 127.1, top, p12); top += 13.8; }
  }
  return top;
}

// ── Tableau de garanties ──────────────────────────────────────────────

const BAS_TABLEAU = 790;

function tableauGrille(doc: Doc, tb: TableauGaranties, nouvellePage: () => void) {
  const X0 = 34.0, X1 = 166.3, X2 = 338.8, X3 = 551.5, XM = 430.8;
  const bleu = "#b8cce4", p8: Style = { f: TR, s: 8.04 }, b8: Style = { f: TB, s: 8.04 };
  const bande = (y: number, h: number) => { doc.rect(X0 + 0.48, y, X3 - X0 - 0.48, h).fill(bleu); ligneH(doc, X0, X3 + 0.48, y); ligneH(doc, X0, X3 + 0.48, y + h); ligneV(doc, X0, y, y + h); ligneV(doc, X3, y, y + h); };
  // En-tête (3 rangées)
  let y = 52.2;
  doc.rect(X0 + 0.48, y, X3 - X0 - 0.48, 16.7).fill(bleu);
  ligneH(doc, X0, X3 + 0.48, y);
  for (const x of [X0, X1, X2, X3]) ligneV(doc, x, y, y + 16.7);
  const b9: Style = { f: TB, s: 9 };
  t(doc, "RUBRIQUES DE GARANTIES", 37.8, y + 0.9, b9);
  t(doc, "TAUX DE COUVERTURE", 170.2, y + 0.9, b9);
  t(doc, "PLAFOND DE REMBOURSEMENT", (X2 + X3) / 2, y + 0.9, b9, "c");
  y += 16.7;
  ligneH(doc, X0, X3 + 0.48, y);
  for (const x of [X0, X2, XM, X3]) ligneV(doc, x, y, y + 26.4);
  const b10: Style = { f: TB, s: 9.96 }, b10b: Style = { ...b10, c: "#0070c0" };
  let x = 37.8 + t(doc, "TERRITORIALITE : ", 37.8, y + 0.9, b10);
  t(doc, tb.territorialite, x, y + 0.9, b10b);
  if (tb.tauxAmbulatoire || tb.tauxHospitalisation) {
    x = 37.8 + t(doc, "TAUX : AMBULATOIRES : ", 37.8, y + 13.7, b10);
    x += t(doc, `${tb.tauxAmbulatoire ?? ""} `, x, y + 13.7, b10b);
    x += t(doc, "- HOSPITALISATIONS : ", x, y + 13.7, b10);
    t(doc, tb.tauxHospitalisation ?? "", x, y + 13.7, b10b);
  }
  t(doc, "ASSURE", 342.7, y + 0.9, b8); t(doc, "AYANTS DROITS", 434.5, y + 0.9, b8);
  y += 26.4;
  doc.rect(X0, y, X3 - X0 + 0.48, 0.96).fill("#000");
  y += 0.96;
  if (tb.titreCollege) { bande(y, 15.4); t(doc, tb.titreCollege, (X0 + X3) / 2, y + 0.3, { f: TB, s: 11.04 }, "c"); y += 15.4; }

  for (const sec of tb.sections) {
    const hauteurs = sec.lignes.map((l) => Math.max(couper(doc, l.libelle, p8, X1 - X0 - 7).length, sec.plafondCommun ? 1 : couper(doc, l.plafond ?? "", p8, X3 - X2 - 8).length));
    const pas = hauteurs.map((n) => 9.3 * n + 5.6);
    const plafondLignes = sec.plafondCommun ? couper(doc, sec.plafondCommun, p8, X3 - X2 - 16) : [];
    let corps = 0.9 + pas.reduce((a, h) => a + h, 0) + 3.4;
    corps = Math.max(corps, plafondLignes.length * 9.3 + 8);
    const hTitre = sec.titre ? 16 : 0;
    if (y + hTitre + Math.min(corps, 120) > BAS_TABLEAU) { nouvellePage(); y = 52.2; ligneH(doc, X0, X3 + 0.48, y); }
    if (sec.titre) { bande(y, 16); t(doc, sec.titre, 37.8, y + 0.9, b8); y += 16; }
    const y0 = y;
    let yy = y + 0.9;
    sec.lignes.forEach((l, i) => {
      couper(doc, l.libelle, p8, X1 - X0 - 7).forEach((s, k) => t(doc, s, 37.8, yy + 9.3 * k, p8));
      if (l.taux) t(doc, l.taux, (X1 + X2) / 2, yy, p8, "c");
      if (!sec.plafondCommun && l.plafond) couper(doc, l.plafond, p8, X3 - X2 - 8).forEach((s, k) => t(doc, s, 342.7, yy + 9.3 * k, p8));
      yy += pas[i];
    });
    y = y0 + corps;
    if (plafondLignes.length) {
      const yp = sec.lignes.length >= 4 ? y0 + (corps - plafondLignes.length * 9.3) / 2 : y0 + 0.9;
      plafondLignes.forEach((s, k) => t(doc, s, (X2 + X3) / 2, yp + 9.3 * k, p8, "c"));
    }
    for (const xx of [X0, X1, X2, X3]) ligneV(doc, xx, y0, y);
    ligneH(doc, X0, X3 + 0.48, y);
  }
  if (tb.piedTableau) {
    if (y + 17 > BAS_TABLEAU) { nouvellePage(); y = 52.2; }
    bande(y, 16.6);
    couper(doc, tb.piedTableau, b10, X3 - X0 - 8).forEach((s, k) => t(doc, s, 37.8, y + 0.4 + 11 * k, b10));
  }
}

function tableauColonnes(doc: Doc, tb: TableauGaranties, nouvellePage: () => void) {
  const X = [22.1, 241.6, 376.8, 554.3], BORD = "#95b3d7", ENTETE = "#4f81bd", PALE = "#dbe5f1";
  const b10: Style = { f: TB, s: 9.96 }, p10: Style = { f: TR, s: 9.96 };
  const colW = [X[1] - X[0] - 11, X[2] - X[1] - 11, X[3] - X[2] - 11];
  const lignes: { cells: string[]; gras: boolean }[] = [];
  for (const s of tb.sections) {
    if (s.titre) lignes.push({ cells: [s.titre, "", s.plafondCommun ?? ""], gras: true });
    for (const l of s.lignes) lignes.push({ cells: [l.libelle, l.taux ?? "", s.titre || !s.plafondCommun ? l.plafond ?? "" : s.plafondCommun], gras: true });
  }
  if (tb.piedTableau) lignes.push({ cells: [tb.piedTableau, "", ""], gras: true });

  let y = 101.4;
  doc.rect(X[0] + 0.48, y + 0.48, X[3] - X[0] - 0.48, 15.7).fill(ENTETE);
  ligneH(doc, X[0], X[3] + 0.48, y, ENTETE); ligneV(doc, X[0], y, y + 16.2, ENTETE); ligneV(doc, X[3], y, y + 16.2, ENTETE);
  t(doc, tb.titreColonneGaranties || "GARANTIES", 27.7, y + 1.0, b10);
  t(doc, tb.titreColonneTaux || "TAUX", 247.2, y + 1.0, b10);
  t(doc, "PLAFOND DE REMBOURSEMENT", 382.4, y + 1.0, b10);
  y += 16.2;
  ligneH(doc, X[0], X[3] + 0.48, y, ENTETE);
  doc.rect(X[0] + 0.48, y + 0.48, X[3] - X[0] - 0.48, 15.7).fill(PALE);
  ligneV(doc, X[0], y, y + 16.2, BORD); ligneV(doc, X[3], y, y + 16.2, BORD);
  t(doc, `TERRITORIALITE : ${tb.territorialite}`, (X[0] + X[3]) / 2, y + 1.0, b10, "c");
  y += 16.2;
  ligneH(doc, X[0], X[3] + 0.48, y, BORD);
  lignes.forEach((l, i) => {
    const txt = l.cells.map((s, k) => (s ? couper(doc, s, k === 0 && l.gras ? b10 : p10, colW[k]) : []));
    const n = Math.max(1, ...txt.map((c) => c.length));
    const h = 16.2 + 15.8 * (n - 1);
    if (y + h > BAS_TABLEAU) { nouvellePage(); y = 56; ligneH(doc, X[0], X[3] + 0.48, y, BORD); }
    if (i % 2 === 1) doc.rect(X[0] + 0.48, y + 0.48, X[3] - X[0] - 0.48, h - 0.48).fill(PALE);
    txt.forEach((c, k) => c.forEach((s, j) => t(doc, s, X[k] + 5.6, y + 1.0 + 11.5 * j, k === 0 ? b10 : p10)));
    for (const x of X) ligneV(doc, x, y, y + h, BORD);
    y += h;
    ligneH(doc, X[0], X[3] + 0.48, y, BORD);
  });
}

// ── Décompte de prime ─────────────────────────────────────────────────

function pageDecompte(doc: Doc, d: DonneesOffre, cot: CotationOffre) {
  const c = cot.contenu;
  bandeau(doc, { x: [51.6, 165.02, 402.46, 530.16], y: [48.12, 112.7], logoSoc: [64.93, 52.62, 84.67, 40.9], logoCli: [412.5, 62.18, 108, 40.9] },
    d, ["DECOMPTE DE PRIME"], [62.25], 284.2);
  infosAssure(doc, d, 58.94, 165.26, 115.09, [57.55, 521.15, 171.52]);
  const p12: Style = { f: TR, s: 12 }, b12: Style = { f: TB, s: 12 };
  t(doc, `Population : ${c.population} personnes`, 58.94, 205.93, b12, "g", true);
  let top = 229.09;
  const prime = (n: number) => `${fmtPts(n)} FCFA`;
  const libellePrime = cot.branche === "Assistance" ? "Prime par personne" : "Prime nette par personne";
  if (c.primeNonCommuniquee) {
    t(doc, `${libellePrime} : Non communiquée`, 58.1, top, p12);
  } else if (c.primeCommuniquee) {
    t(doc, `${libellePrime} communiqué par la compagnie : ${prime(c.primeCommuniquee)}`, 58.1, top, p12);
    top += 27.6;
    const w = t(doc, "Réduction commerciale obtenue :", 58.1, top, b12);
    t(doc, ` ${libellePrime} : ${c.primeParPersonne ? prime(c.primeParPersonne) : ""}`, 58.1 + w, top, p12);
  } else if (c.primeParPersonne) {
    t(doc, `${libellePrime} : ${prime(c.primeParPersonne)}`, 58.1, top, p12);
  }
  if (c.primeNonCommuniquee) return;
  // Tableau (Calibri 14 dans le modèle)
  const X0 = 69.74, X1 = 247.49, X2 = 431.74;
  let y = top + 50.2;
  const lignes: [string, number, boolean][] = [["Prime NETTE", cot.primeNette, false]];
  if (cot.cartes) lignes.push(["Cartes", cot.cartes, false]);
  lignes.push(["Accessoires", cot.accessoires, false], [`Taxe ${Math.round(cot.tauxTaxe * 100) / 100}%`, cot.taxe, false], ["Prime TTC", cot.ttc, true]);
  doc.rect(X0 + 0.48, y + 0.48, X2 - X0 - 0.48, 17.04).fill("#5b9bd5");
  ligneH(doc, X0, X2 + 0.48, y); ligneV(doc, X0, y, y + 17.52); ligneV(doc, X2, y, y + 17.52);
  t(doc, "DECOMPTE DE PRIME", (X0 + X2) / 2, y + 3.27, { f: CAB, s: 14.04 }, "c");
  y += 17.52;
  for (const [l, v, gras] of lignes) {
    ligneH(doc, X0, X2 + 0.48, y);
    const st: Style = { f: gras ? CAB : CA, s: 14.04 };
    t(doc, l, 75.38, y + 4.47, st);
    t(doc, fmtEsp(v).replace(/ /g, " "), 426.6, y + 4.47, st, "d");
    for (const x of [X0, X1, X2]) ligneV(doc, x, y, y + 19.2);
    y += 19.2;
  }
  ligneH(doc, X0, X2 + 0.48, y);
}

// ── Récapitulatif comparatif ──────────────────────────────────────────

function pageComparatif(doc: Doc, d: DonneesOffre) {
  const paysage = d.compagnies.length >= 5;
  const W = paysage ? PAGE_H : PAGE_W;
  doc.addPage({ size: paysage ? [PAGE_H, PAGE_W] : [PAGE_W, PAGE_H], margin: 0 });
  const dx = paysage ? (W - PAGE_W) / 2 - 30 : 0;
  bandeau(doc, { x: [73.8 + dx, 187.2 + dx, 424.8 + dx, 552.6 + dx], y: [70.4, 139.0], logoSoc: [87.1 + dx, 75.4, 84.7, 40.9], logoCli: [434.8 + dx, 84.9, 108, 40.9] },
    d, ["RECAPITULATIF DES PRIMES"], [101.5], 306.0 + dx);
  const p12: Style = { f: TR, s: 12 };
  const xi = 78.7 + dx;
  const w = t(doc, "Nom de l’assuré : ", xi, 141.8, p12);
  t(doc, d.clientNom, xi + w, 140.0, { f: TB, s: 14.04 });
  t(doc, "Adresse de l’assuré", xi, 156.5, p12); t(doc, `: ${d.params.adresseAssure}`, xi + 123.4, 156.5, p12);
  t(doc, "Période de garantie", xi, 170.3, p12); t(doc, `: ${d.params.periode}`, xi + 123.4, 170.3, p12);
  t(doc, "Durée", xi, 184.1, p12); t(doc, `: ${d.params.duree}`, xi + 86.6, 184.1, p12);
  doc.rect(75.6 + dx, 211.7 - 13.8, 481.2, 1.45).fill(MARINE);

  // Lignes = libellés comparatifs distincts, dans l'ordre d'apparition.
  const libelles: string[] = [];
  for (const c of d.compagnies) for (const l of c.cotations) if (!libelles.includes(l.contenu.libelleComparatif)) libelles.push(l.contenu.libelleComparatif);
  const X0 = 28.2, XC = 156.6, XF = paysage ? W - 50 : 546.5;
  const cw = (XF - XC) / d.compagnies.length;
  const b10: Style = { f: TB, s: 9.96 }, p10: Style = { f: TR, s: 9.96 };
  let y = 297.2;
  // En-tête saumon + logos
  d.compagnies.forEach((c, i) => {
    const x = XC + cw * i;
    doc.rect(x + 0.48, y + 0.4, cw - 0.48, 12.4).fill("#f4af84");
    t(doc, c.nom.toUpperCase(), x + 3.9, y + 0.9, b10);
    image(doc, c.logoPetit ?? c.logo, x + 4, y + 13.6, cw - 8, 30);
  });
  ligneH(doc, XC, XF + 0.48, y); ligneH(doc, XC, XF + 0.48, y + 12.8);
  for (let i = 0; i <= d.compagnies.length; i++) ligneV(doc, XC + cw * i, y, y + 48.6);
  y += 48.6;
  ligneH(doc, X0, XF + 0.48, y);
  const totaux = d.compagnies.map(() => 0);
  for (const lib of libelles) {
    const lignesLib = couper(doc, lib, p10, XC - X0 - 8);
    const h = Math.max(14.4, 12.8 * lignesLib.length + 0.4);
    doc.rect(X0 + 0.48, y + 0.4, XC - X0 - 0.48, h - 0.4).fill("#bcd6ed");
    lignesLib.forEach((s, k) => t(doc, s, X0 + 4, y + 1.4 + 12.8 * k, p10));
    d.compagnies.forEach((c, i) => {
      const cot = c.cotations.find((l) => l.contenu.libelleComparatif === lib);
      const val = !cot ? "—" : cot.contenu.primeNonCommuniquee ? "Non communiqué" : fmtEsp(cot.ttc);
      if (cot && !cot.contenu.primeNonCommuniquee) totaux[i] += cot.ttc;
      t(doc, val, XC + cw * (i + 1) - 2.3, y + (h - 11) / 2, p10, "d");
    });
    for (let i = 0; i <= d.compagnies.length; i++) ligneV(doc, XC + cw * i, y, y + h);
    ligneV(doc, X0, y, y + h);
    y += h;
    ligneH(doc, X0, XF + 0.48, y);
  }
  t(doc, "TOTAUX", (X0 + XC) / 2, y + 2.4, b10, "c");
  totaux.forEach((v, i) => t(doc, fmtEsp(v), XC + cw * (i + 1) - 2.3, y + 2.4, b10, "d"));
  for (let i = 0; i <= d.compagnies.length; i++) ligneV(doc, XC + cw * i, y, y + 14.4);
  ligneV(doc, X0, y, y + 14.4);
  ligneH(doc, X0, XF + 0.48, y + 14.4);
}

// ── Corps du document (couverture → comparatif) ───────────────────────

// Renvoie le dernier numéro de page imprimé (la numérotation commence au
// premier intercalaire, comme dans le modèle : couverture et récapitulatif
// ne sont pas numérotés).
export function genererCorpsOffre(doc: Doc, d: DonneesOffre): number {
  doc.registerFont(CA, path.join(ASSETS, "Carlito-Regular.ttf"));
  doc.registerFont(CAB, path.join(ASSETS, "Carlito-Bold.ttf"));
  pageCouverture(doc, d);
  pagesRecap(doc, d);
  let numero = 0;
  const nouvelle = () => { doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 }); numeroPage(doc, ++numero); };
  for (const c of d.compagnies) {
    nouvelle(); pageIntercalaire(doc, d, c);
    for (const cot of c.cotations) {
      nouvelle(); pageProposition(doc, d, cot);
      const tb = cot.contenu.tableau;
      if (tb && tb.sections.length) {
        nouvelle();
        (tb.style === "colonnes" ? tableauColonnes : tableauGrille)(doc, tb, nouvelle);
      }
      nouvelle(); pageDecompte(doc, d, cot);
    }
  }
  if (d.compagnies.length > 1) { pageComparatif(doc, d); numeroPage(doc, ++numero); }
  return numero;
}

// ── Présentation des portails MEDASSUR+ ───────────────────────────────

// Remplace les pages « B – OUTILS DEMATERIALISES » du modèle (Passeport
// Médical, SI Médical, Eyone-Tiers) par les portails réels de MEDASSUR+,
// même mise en page (Calibri, titres numérotés, texte justifié) avec deux
// vraies captures d'écran par portail (société de démonstration, données
// fictives — jamais les données d'un vrai assuré).
interface Portail { titre: string; texte: string; points: string[]; captures: [string, string] }
const PORTAILS = (societe: string): Portail[] => [
  {
    titre: `LE PORTAIL DE GESTION ${societe}`,
    texte: `Le portail de gestion est l'outil de travail quotidien des équipes de ${societe}. Il centralise toute la vie du contrat santé : cotations et appels d'offres, contrats et avenants, mouvements de population (incorporations, retraits), émission des cartes d'assurance, saisie et contrôle des factures des prestataires, accords préalables et prises en charge, règlements et reporting.`,
    points: [
      "Tableau de bord de pilotage : primes émises, sinistralité (S/P), assurés et trésorerie en temps réel ;",
      "Contrôle des factures ligne à ligne, au regard des garanties et plafonds du contrat ;",
      "Gestion électronique des documents et lecture automatique des pièces par l'assistant IA ARIANA ;",
      "Rapports statistiques par rubrique, bénéficiaire et prestataire, exportables en PDF.",
    ],
    captures: ["gestion-1", "gestion-2"],
  },
  {
    titre: "LE PORTAIL DES PRESTATAIRES ET DES MÉDECINS",
    texte: "Les établissements du réseau de soins (hôpitaux, cliniques, pharmacies, laboratoires…) et les médecins prescripteurs disposent chacun de leur espace. Le prestataire identifie l'assuré (carte, QR code, matricule ou téléphone), vérifie ses droits et son taux de prise en charge, saisit ses prestations et transmet ses factures en ligne. Le médecin gère sa file d'attente et ses consultations, établit des ordonnances électroniques transmises directement aux pharmacies du réseau et consulte le dossier de ses patients.",
    points: [
      "Identification instantanée de l'assuré et contrôle des droits avant les soins ;",
      "Bons de prise en charge, prestations et factures dématérialisés ;",
      "Ordonnance électronique lue et délivrée par les pharmacies conventionnées ;",
      "Suivi des règlements et messagerie avec le gestionnaire.",
    ],
    captures: ["prestataire-1", "medecin-1"],
  },
  {
    titre: "LE PORTAIL DE L'ASSURÉ (WEB ET APPLICATION MOBILE)",
    texte: "Chaque assuré principal dispose de son espace, sur le web comme sur l'application mobile : carte d'assurance électronique pour lui et ses ayants droit, garanties et plafonds de son contrat, demandes de prise en charge et de remboursement suivies en temps réel, réseau de soins avec les prestataires les plus proches, e-carnet de santé et historique des consommations du foyer.",
    points: [
      "Carte d'assurance santé de chaque membre de la famille, toujours disponible ;",
      "Taux de couverture et plafonds consultables à tout moment ;",
      "Demandes de prise en charge et de remboursement en ligne, avec pièces jointes ;",
      "Messagerie directe avec le gestionnaire santé.",
    ],
    captures: ["assure-1", "assure-2"],
  },
  {
    titre: "LE PORTAIL DU SOUSCRIPTEUR",
    texte: "L'entreprise souscriptrice suit son contrat en toute autonomie : contrats et documents, liste de ses bénéficiaires, demandes d'incorporation et de retrait, réseau de soins, procédures, gestion de ses propres utilisateurs et statistiques de consommation (par mois, par famille, par bénéficiaire, par prestataire, par rubrique et évolution du S/P).",
    points: [
      "Vue d'ensemble des contrats, participants et prises en charge par rubrique ;",
      "Incorporations et retraits demandés en ligne, avec suivi de leur traitement ;",
      "Statistiques de consommation pour piloter le budget santé de l'entreprise ;",
      "Comptes utilisateurs et droits d'accès gérés par l'entreprise elle-même.",
    ],
    captures: ["souscripteur-1", "souscripteur-2"],
  },
];

export function genererPagesPortails(doc: Doc, societe: string, premierNumero: number) {
  doc.registerFont(CA, path.join(ASSETS, "Carlito-Regular.ttf"));
  doc.registerFont(CAB, path.join(ASSETS, "Carlito-Bold.ttf"));
  const corps: Style = { f: CA, s: 11.04 }, gras: Style = { f: CAB, s: 11.04 };
  const X = 56.7, L = 481.9;
  PORTAILS(societe).forEach((po, i) => {
    doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
    t(doc, String(premierNumero + i), 538.6, 801.4, { f: TR, s: 11.04 }, "d");
    let top = 72.1;
    if (i === 0) { t(doc, "B – OUTILS DEMATERIALISES", 92.7, top, gras, "g", true); top = 117.1; }
    t(doc, `${i + 1}.`, 92.7, top, gras);
    t(doc, po.titre, 110.7, top, gras);
    top += 22;
    doc.font(CA).fontSize(11.04).fillColor("#000").text(winAnsi(po.texte), X, top, { width: L, align: "justify", lineGap: 0.3 });
    top = doc.y + 8;
    for (const pt of po.points) {
      rond(doc, 74.4, top - 1.5);
      doc.font(CA).fontSize(11.04).text(winAnsi(pt), 92.7, top, { width: X + L - 92.7, align: "left" });
      top = doc.y + 2;
    }
    top += 10;
    const h = Math.min(L * 733 / 1400, (790 - top - 14) / 2), w = h * 1400 / 733;
    po.captures.forEach((c, k) => {
      const y = top + k * (h + 14), x = X + (L - w) / 2;
      image(doc, path.join(ASSETS, "portails", `${c}.jpg`), x, y, w, h);
      doc.rect(x, y, w, h).lineWidth(0.5).stroke("#c9d3df");
    });
  });
  return PORTAILS(societe).length;
}

// ── Données ───────────────────────────────────────────────────────────

// PDFKit et pdf-lib ne lisent que PNG/JPEG : tout logo est normalisé en PNG
// (transparence conservée). Image illisible → null, jamais bloquant.
export async function versPng(img: ImageSrc | null): Promise<Buffer | null> {
  if (!img) return null;
  try { return await sharp(img).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).png().toBuffer(); } catch { return null; }
}

// Logos des compagnies tels qu'imprimés dans les offres de référence, avec
// leur taille sur l'intercalaire (pt) — préférés au logo en base pour un
// rendu identique au modèle.
const LOGOS_MODELE: [RegExp, string, [number, number], boolean][] = [
  [/ASSINCO/, "assinco", [243, 93], true], [/OGAR/, "ogar", [187, 146], true], [/AXA/, "axa", [186, 145], true],
  [/SANLAM|ALLIANZ/, "sanlam-allianz", [298, 145], true], [/NSIA/, "nsia", [212, 141], true], [/SUNU/, "sunu", [212, 122], false],
];
export function logoModeleCompagnie(nom: string): { logo: string; petit: string; taille: [number, number] } | null {
  const n = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const m = LOGOS_MODELE.find(([re]) => re.test(n));
  if (!m) return null;
  const dir = path.join(ASSETS, "logos");
  return { logo: path.join(dir, `${m[1]}.png`), petit: path.join(dir, m[3] ? `${m[1]}-petit.png` : `${m[1]}.png`), taille: m[2] };
}

// ── Assemblage final ──────────────────────────────────────────────────

export function pdfVersBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const morceaux: Buffer[] = [];
    doc.on("data", (b: Buffer) => morceaux.push(b));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);
  });
}

// Corps PDFKit + pages de présentation copiées du modèle (outils de gestion,
// carte santé — renumérotées, logo client et vraie carte réinsérés) +
// pages des portails MEDASSUR+ + annexe réseau.
export interface PiecesPresentation { carte: Buffer | null; portails: Buffer | null }
// Emplacements recto / verso de la carte sur la page « LA CARTE SANTE » du modèle (pt, depuis le haut).
const CARTE_RECTO = [56.7, 99.3, 218.9, 139.1], CARTE_VERSO = [281.1, 100.1, 218.3, 138.7];

export async function assemblerOffre(corps: Buffer, dernierNumero: number, annexe: Buffer | null, presentation: PiecesPresentation | null, clientLogoPng: Buffer | null): Promise<Buffer> {
  const final = await PdfLib.load(corps);
  if (presentation) {
    const src = await PdfLib.load(fs.readFileSync(path.join(ASSETS, "presentation.pdf")));
    const pages = await final.copyPages(src, src.getPageIndices());
    const times = await final.embedFont(StandardFonts.TimesRoman);
    const logo = clientLogoPng ? await final.embedPng(clientLogoPng) : null;
    const carte = presentation.carte ? await PdfLib.load(presentation.carte) : null;
    const faces = carte ? await final.embedPdf(carte, carte.getPageIndices().slice(0, 2)) : [];
    pages.forEach((pg, i) => {
      final.addPage(pg);
      const n = String(dernierNumero + 1 + i);
      pg.drawText(n, { x: 538.6 - times.widthOfTextAtSize(n, 11.04), y: pg.getHeight() - (801.4 + 0.891 * 11.04), size: 11.04, font: times, color: rgb(0, 0, 0) });
      if (i === 0 && logo) {
        const s = Math.min(61.3 / logo.width, 40.9 / logo.height);
        const w = logo.width * s, h = logo.height * s;
        pg.drawImage(logo, { x: 491.25 - w / 2, y: pg.getHeight() - 104.75 - h / 2, width: w, height: h });
      }
      if (i === 1) faces.forEach((f, k) => {
        const [x, top, w, h] = k === 0 ? CARTE_RECTO : CARTE_VERSO;
        pg.drawPage(f, { x, y: pg.getHeight() - top - h, width: w, height: h });
      });
    });
    if (presentation.portails) {
      const p = await PdfLib.load(presentation.portails);
      for (const pg of await final.copyPages(p, p.getPageIndices())) final.addPage(pg);
    }
  }
  if (annexe) {
    const src = await PdfLib.load(annexe);
    for (const pg of await final.copyPages(src, src.getPageIndices())) final.addPage(pg);
  }
  return Buffer.from(await final.save());
}

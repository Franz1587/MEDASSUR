import * as fs from "fs";
import * as path from "path";
import { ASSETS_ROOT } from "../uploads-dir.util";

// Réseau de Soins — document officiel, mise en page reproduite à l'identique du
// modèle validé (Reseau-de-Soins-La-Ruche.pdf). Toutes les cotes (pt A4) sont
// relevées sur ce modèle ; seules les données (prestataires, villes, comptes,
// identité société) sont dynamiques. Icônes, carte du Gabon et recadrages photo
// viennent de assets/reseau-soins (extraits du modèle).

type Doc = PDFKit.PDFDocument;
const DIR = path.join(ASSETS_ROOT, "reseau-soins");

export interface PrestataireAnnuaire {
  nom: string;
  type: string | null;
  adresse: string | null;
  telephone: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
export interface VilleAnnuaire { nom: string; prestataires: PrestataireAnnuaire[] }
export interface ProvinceAnnuaire { nom: string; villes: VilleAnnuaire[] }
export interface SocieteAnnuaire {
  nom: string;
  sousTitre?: string | null;
  adresse?: string | null;
  boitePostale?: string | null;
  ville?: string | null;
  pays?: string | null;
  telephone?: string | null;
  email?: string | null;
  siteWeb?: string | null;
  couleurPrimaire?: string | null;
  couleurSecondaire?: string | null;
}

interface Icone { d: string; sw: number; w: number; h: number }
interface Carte {
  provinces: Record<string, { d: string; label: [number, number, number] }>;
  villes: Record<string, { x: number; y: number; cote: "d" | "g" }>;
  projection: { x: number[]; y: number[] };
}
let ressources: { icones: Record<string, Icone>; carte: Carte } | null = null;
function res() {
  ressources ??= {
    icones: JSON.parse(fs.readFileSync(path.join(DIR, "icons.json"), "utf8")).icons,
    carte: JSON.parse(fs.readFileSync(path.join(DIR, "carte-gabon.json"), "utf8")),
  };
  return ressources;
}
const photo = (n: string) => path.join(DIR, "photos", `${n}.jpg`);

// ── Palette ─────────────────────────────────────────────────────────────────
// Palette du modèle. Une société dont les couleurs sont de la même famille de
// teinte (±12°, cas LA RUCHE : #0672d0/#f59105) reçoit la palette exacte du
// modèle ; sinon chaque couleur est décalée vers la teinte de la société.
const REF = {
  bleu: "#0b6fc4", orange: "#f47a01", marine: "#0a2f5c", hero: "#0a3d73", orangeTexte: "#b85500",
  orangeChiffre: "#c96400", gris: "#3d4a5c", grisClair: "#5a6577", bord: "#d8e3f0", sep: "#e4ecf5",
  piste: "#e6eef7", zebra: "#f5f9fd", texteBande: "#d6e2f2", bordContact: "#3b6798", bordPastille: "#9db4cf",
  labelClair: "#2b4466", encre: "#1b2433", b1: "#d5e5f5", b2: "#a8caec", b3: "#74a9dd", b4: "#2b78c2", b5: "#0b4e8f",
};
type Palette = typeof REF;
const FAMILLE_ORANGE = new Set(["orange", "orangeTexte", "orangeChiffre"]);

function hexVersHsl(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hh * 60, s, l];
}
function hslVersHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function ecartTeinte(couleur: string | null | undefined, ref: string): number {
  if (!couleur || !/^#[0-9a-f]{6}$/i.test(couleur)) return 0;
  const [h, s] = hexVersHsl(couleur.toLowerCase());
  if (s < 0.15) return 0;
  const d = ((h - hexVersHsl(ref)[0] + 540) % 360) - 180;
  return Math.abs(d) <= 12 ? 0 : d;
}
export function paletteReseau(prim?: string | null, sec?: string | null): Palette {
  const dB = ecartTeinte(prim, REF.bleu), dO = ecartTeinte(sec, REF.orange);
  const out = { ...REF };
  for (const k of Object.keys(REF) as (keyof Palette)[]) {
    const d = FAMILLE_ORANGE.has(k) ? dO : dB;
    if (d) { const [h, s, l] = hexVersHsl(REF[k]); out[k] = hslVersHex((h + d + 360) % 360, s, l); }
  }
  return out;
}

// ── Polices ─────────────────────────────────────────────────────────────────
const M7 = "RS-Montserrat-Bold", M8 = "RS-Montserrat-ExtraBold", M9 = "RS-Montserrat-Black";
const I4 = "RS-Inter-Regular", I5 = "RS-Inter-Medium", I6 = "RS-Inter-SemiBold", I7 = "RS-Inter-Bold";
function enregistrerPolices(doc: Doc) {
  const f = (n: string) => path.join(DIR, "fonts", n);
  doc.registerFont(M7, f("Montserrat-Bold.ttf"));
  doc.registerFont(M8, f("Montserrat-ExtraBold.ttf"));
  doc.registerFont(M9, f("Montserrat-Black.ttf"));
  doc.registerFont(I4, f("Inter-Regular.ttf"));
  doc.registerFont(I5, f("Inter-Medium.ttf"));
  doc.registerFont(I6, f("Inter-SemiBold.ttf"));
  doc.registerFont(I7, f("Inter-Bold.ttf"));
}

// ── Primitives ──────────────────────────────────────────────────────────────
interface StyleTexte { f: string; s: number; c: string; ls?: number }
// Inter statique 18pt est ~1 % plus étroite que l'Inter variable du modèle à 9pt.
const lsDefaut = (st: StyleTexte) => st.ls ?? (st.f.startsWith("RS-Inter") ? 0.08 : 0);
function largeur(doc: Doc, s: string, st: StyleTexte) {
  return doc.font(st.f).fontSize(st.s).widthOfString(s, { characterSpacing: lsDefaut(st) });
}
// Texte sur une ligne, jamais de saut automatique ; a = ancre ("g" gauche, "d" bord droit, "c" centre).
function texte(doc: Doc, s: string, x: number, y: number, st: StyleTexte, a: "g" | "d" | "c" = "g", opts: { stroke?: boolean } = {}) {
  const w = largeur(doc, s, st);
  const xx = a === "g" ? x : a === "d" ? x - w : x - w / 2;
  doc.font(st.f).fontSize(st.s);
  if (opts.stroke) doc.text(s, xx, y, { lineBreak: false, characterSpacing: lsDefaut(st), stroke: true, fill: false });
  else doc.fillColor(st.c).text(s, xx, y, { lineBreak: false, characterSpacing: lsDefaut(st) });
  return w;
}
// Plusieurs morceaux de styles différents enchaînés sur une même ligne.
function morceaux(doc: Doc, parts: [string, StyleTexte][], x: number, y: number, a: "g" | "d" = "g") {
  const total = parts.reduce((t, [s, st]) => t + largeur(doc, s, st), 0);
  let xx = a === "g" ? x : x - total;
  for (const [s, st] of parts) xx += texte(doc, s, xx, y, st);
  return total;
}
function couper(doc: Doc, s: string, st: StyleTexte, max: number): string[] {
  const lignes: string[] = [];
  let cur = "";
  for (const mot of s.split(/\s+/).filter(Boolean)) {
    const essai = cur ? `${cur} ${mot}` : mot;
    if (!cur || largeur(doc, essai, st) <= max) cur = essai;
    else { lignes.push(cur); cur = mot; }
  }
  if (cur) lignes.push(cur);
  return lignes.length ? lignes : [""];
}
function tronquer(doc: Doc, s: string, st: StyleTexte, max: number) {
  if (largeur(doc, s, st) <= max) return s;
  while (s.length > 1 && largeur(doc, `${s}…`, st) > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}
const pointsHex = (cx: number, cy: number, r: number): [number, number][] =>
  [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 180) * (-90 + 60 * i); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
function hexagone(doc: Doc, cx: number, cy: number, r: number) {
  return doc.polygon(...pointsHex(cx, cy, r));
}
function icone(doc: Doc, nom: string, cx: number, cy: number, couleur: string) {
  const ic = res().icones[nom];
  doc.save().translate(cx, cy);
  if (ic.sw > 0) doc.path(ic.d).lineWidth(ic.sw).lineCap("round").lineJoin("round").strokeColor(couleur).stroke();
  else doc.path(ic.d).fillColor(couleur).fill();
  doc.restore();
}
// Image recadrée dans un hexagone (rect = position exacte de l'image dans le modèle).
function photoHex(doc: Doc, fichier: string, cx: number, cy: number, r: number, rect: [number, number, number, number]) {
  doc.save();
  hexagone(doc, cx, cy, r).clip();
  doc.image(photo(fichier), rect[0], rect[1], { width: rect[2] - rect[0], height: rect[3] - rect[1] });
  doc.restore();
}
// Fond « nid d'abeille » du modèle : hexagones pointe en haut, r = 26, pas 45 × 39.
function grilleHex(doc: Doc, x0: number, y0: number, x1: number, y1: number, ox: number, oy: number) {
  const r = 45 / Math.sqrt(3);
  let d = "";
  const mMin = Math.floor((y0 - oy) / 39) - 1, mMax = Math.ceil((y1 - oy) / 39) + 1;
  for (let m = mMin; m <= mMax; m++) {
    const cy = oy + 39 * m, dx = (((m % 2) + 2) % 2) === 0 ? ox : ox - 22.5;
    for (let k = Math.floor((x0 - dx) / 45) - 1; k <= Math.ceil((x1 - dx) / 45) + 1; k++) {
      const p = pointsHex(dx + 45 * k, cy, r);
      d += `M${p.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
    }
  }
  doc.save().rect(x0, y0, x1 - x0, y1 - y0).clip();
  doc.path(d).lineWidth(1).strokeColor("#ffffff").strokeOpacity(0.13).stroke();
  doc.restore();
}
function logoDans(doc: Doc, logo: Buffer | string | null, x: number, y: number, wMax: number, hMax: number, ancre: "g" | "c" = "g"): { w: number; h: number } | null {
  if (!logo) return null;
  try {
    const img = (doc as unknown as { openImage(src: Buffer | string): { width: number; height: number } }).openImage(logo);
    const e = Math.min(wMax / img.width, hMax / img.height);
    const w = img.width * e, h = img.height * e;
    doc.image(img as unknown as Buffer, ancre === "g" ? x : x - w / 2, ancre === "g" ? y : y - h / 2, { width: w, height: h });
    return { w, h };
  } catch {
    return null;
  }
}

// ── Catalogue des types ─────────────────────────────────────────────────────
interface InfoType { cle: string; badge: string; pluriel: string; icone: string; c: string; fond: string }
const TYPES: InfoType[] = [
  { cle: "hopital", badge: "Hôpital", pluriel: "Hôpitaux", icone: "ty_hopital", c: "#b3261e", fond: "#fdecea" },
  { cle: "clinique", badge: "Clinique", pluriel: "Cliniques", icone: "ty_clinique", c: "#0b5fa8", fond: "#e5f0fb" },
  { cle: "cabinet", badge: "Cabinet médical", pluriel: "Cabinets médicaux", icone: "ty_cabinet", c: "#0e6e5f", fond: "#e2f3f0" },
  { cle: "dentaire", badge: "Cabinet dentaire", pluriel: "Cabinets dentaires", icone: "ty_dentaire", c: "#5b3ca6", fond: "#eee8fa" },
  { cle: "imagerie", badge: "Imagerie", pluriel: "Imagerie médicale", icone: "ty_imagerie", c: "#37474f", fond: "#eceff1" },
  { cle: "laboratoire", badge: "Laboratoire", pluriel: "Laboratoires", icone: "ty_laboratoire", c: "#283593", fond: "#e8eaf6" },
  { cle: "kine", badge: "Kinésithérapie", pluriel: "Kinésithérapie", icone: "ty_cabinet", c: "#00695c", fond: "#e0f2f1" },
  { cle: "pharmacie", badge: "Pharmacie", pluriel: "Pharmacies", icone: "ty_pharmacie", c: "#1e6b24", fond: "#e6f4e7" },
  { cle: "depot", badge: "Dépôt pharma.", pluriel: "Dépôts pharmaceutiques", icone: "ty_depot", c: "#8a4b00", fond: "#fff1df" },
  { cle: "opticien", badge: "Opticien", pluriel: "Opticiens", icone: "ty_opticien", c: "#a34700", fond: "#ffebdc" },
  { cle: "autre", badge: "Autre", pluriel: "Autres", icone: "ty_cabinet", c: "#455a64", fond: "#eceff1" },
];
function infoType(type: string | null): InfoType {
  const t = (type || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cle = t.includes("hopital") ? "hopital" : t.includes("clinique") ? "clinique" : t.includes("dentaire") ? "dentaire"
    : t.includes("imagerie") ? "imagerie" : t.includes("laboratoire") ? "laboratoire" : t.includes("kine") ? "kine"
    : t.includes("depot") ? "depot" : t.includes("pharmacie") ? "pharmacie" : t.includes("opticien") || t.includes("optique") ? "opticien"
    : t.includes("cabinet") || t.includes("medecin") ? "cabinet" : "autre";
  return TYPES.find((x) => x.cle === cle)!;
}
const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;
const pct = (n: number, total: number) => `${(total ? (n / total) * 100 : 0).toFixed(1).replace(".", ",")} %`;

// ── Génération ──────────────────────────────────────────────────────────────
interface Ctx {
  doc: Doc; P: Palette; soc: SocieteAnnuaire; logo: Buffer | string | null;
  provinces: ProvinceAnnuaire[]; total: number; nbVilles: number; nbProvs: number; nomMaj: string;
}

export function genererReseauSoins(doc: Doc, soc: SocieteAnnuaire, logo: Buffer | string | null, provinces: ProvinceAnnuaire[]) {
  enregistrerPolices(doc);
  const total = provinces.reduce((t, p) => t + p.villes.reduce((s, v) => s + v.prestataires.length, 0), 0);
  const ctx: Ctx = {
    doc, P: paletteReseau(soc.couleurPrimaire, soc.couleurSecondaire), soc, logo, provinces, total,
    nbVilles: provinces.reduce((t, p) => t + p.villes.length, 0),
    nbProvs: provinces.filter((p) => p.nom !== "Autres").length,
    nomMaj: (soc.nom || "").toUpperCase(),
  };
  couverture(ctx);
  doc.addPage(); statistiques(ctx);
  doc.addPage(); carte(ctx);
  doc.addPage();
  const premiere = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
  annuaire(ctx);
  const derniere = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
  doc.addPage(); quatriemeCouverture(ctx);
  // Pied « Annuaire · i/N » : N n'est connu qu'une fois l'annuaire paginé.
  const n = derniere - premiere + 1;
  for (let i = 0; i < n; i++) {
    doc.switchToPage(premiere + i);
    morceaux(doc, [[ctx.nomMaj, { f: I7, s: 6, c: ctx.P.marine }], [" — Réseau de Soins Conventionné", { f: I4, s: 6, c: ctx.P.grisClair }]], 36, 820.1);
    texte(doc, `Annuaire · ${i + 1}/${n}`, 559.3, 820.1, { f: I4, s: 6, c: ctx.P.grisClair }, "d");
  }
}

function enteteSociete(ctx: Ctx, titre: string, sousTitre: string, y: number) {
  const { doc, P } = ctx;
  if (!logoDans(doc, ctx.logo, 36, y - 0.6, 160, 36)) texte(doc, ctx.nomMaj, 36, y + 8, { f: M8, s: 12, c: P.marine });
  texte(doc, titre, 559.5, y, { f: M8, s: 18, c: P.marine }, "d");
  texte(doc, sousTitre, 559.5 - 0.75, y + 23.9, { f: I7, s: 9, c: P.orangeTexte, ls: 0.75 }, "d");
}

function piedStats(ctx: Ctx, gauche: string, droite: string, numero: string) {
  const { doc, P } = ctx;
  doc.rect(36, 798.75, 523.5, 0.75).fill(P.bord);
  morceaux(doc, [[ctx.nomMaj, { f: I7, s: 9, c: P.marine }], [` — ${gauche}`, { f: I4, s: 9, c: P.grisClair }]], 36, 809);
  texte(doc, droite, 528, 809.3, { f: I4, s: 9, c: P.grisClair }, "d");
  doc.rect(535.5, 807, 24, 14.25).fill(P.orange);
  texte(doc, numero, 547.5, 809.3, { f: I7, s: 9, c: P.encre }, "c");
}

function titreSection(ctx: Ctx, s: string, y: number) {
  ctx.doc.rect(36, y + 6.3, 13.5, 3).fill(ctx.P.orange);
  texte(ctx.doc, s, 57, y, { f: M8, s: 12, c: ctx.P.marine });
}

// ── Page 1 : couverture ─────────────────────────────────────────────────────
const SLOTS_COUV: { f: string; label: string; cx: number; cy: number; rect: [number, number, number, number] }[] = [
  { f: "hospitalisation", label: "Hospitalisation", cx: 225.75, cy: 163.5, rect: [129.8, 100.5, 331.5, 226.5] },
  { f: "hopitaux", label: "Hôpitaux", cx: 369.75, cy: 163.5, rect: [240.8, 100.5, 469.5, 226.5] },
  { f: "pharmacies", label: "Pharmacies", cx: 153.75, cy: 288, rect: [63.8, 225, 291.8, 351] },
  { f: "consultations", label: "Consultations", cx: 441.75, cy: 288, rect: [360, 225, 607.5, 351] },
  { f: "imagerie", label: "Imagerie médicale", cx: 225.75, cy: 412.5, rect: [126, 349.5, 317.2, 475.5] },
  { f: "laboratoires", label: "Laboratoires", cx: 369.75, cy: 412.5, rect: [245.2, 349.5, 494.2, 475.5] },
];
const ICONES_COTE: { ic: string; label: string; x: number; y: number; plein: boolean }[] = [
  { ic: "cv_dentaire", label: "Dentaire", x: 46.5, y: 168, plein: true },
  { ic: "cv_optique", label: "Optique", x: 46.5, y: 288, plein: false },
  { ic: "cv_depots", label: "Dépôts", x: 46.5, y: 408, plein: true },
  { ic: "cv_cliniques", label: "Cliniques", x: 549, y: 168, plein: false },
  { ic: "cv_cabinets", label: "Cabinets", x: 549, y: 288, plein: true },
  { ic: "cv_assurance", label: "Assurance", x: 549, y: 408, plein: false },
];

function couverture(ctx: Ctx) {
  const { doc, P, soc } = ctx;
  const W = doc.page.width;
  if (!logoDans(doc, ctx.logo, 36, 12, 200, 54)) texte(doc, ctx.nomMaj, 36, 30, { f: M8, s: 16, c: P.marine });
  const ls1 = 1.44;
  texte(doc, (soc.sousTitre || "Courtier d'Assurances").toUpperCase(), 559.5 - ls1, 25.8, { f: M7, s: 9, c: P.marine, ls: ls1 }, "d");
  const pays = (soc.pays || "Gabon").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const wSous = texte(doc, `Assurance santé · ${pays}`, 559.5, 42.1, { f: I5, s: 9, c: P.grisClair }, "d");
  const xBleu = 559.5 - wSous - 4.5 - 10.4;
  doc.rect(xBleu, 45.75, 10.4, 3).fill(P.bleu);
  doc.rect(xBleu - 4.6 - 21, 45.75, 21, 3).fill(P.orange);

  // Bandeau photo
  doc.rect(0, 78, W, 420).fill(P.hero);
  grilleHex(doc, 0, 78, W, 498, 22.5, 116.75);
  doc.save().lineWidth(1.5).dash(2.25, { space: 4.5 }).strokeColor("#ffffff").strokeOpacity(0.25);
  for (const [a, b] of [[2, 3], [0, 5], [1, 4]]) {
    doc.moveTo(SLOTS_COUV[a].cx, SLOTS_COUV[a].cy).lineTo(SLOTS_COUV[b].cx, SLOTS_COUV[b].cy).stroke();
  }
  doc.moveTo(46.5, 168).lineTo(46.5, 411).stroke().moveTo(549, 168).lineTo(549, 411).stroke();
  doc.undash().restore();
  for (const s of ICONES_COTE) {
    if (s.plein) hexagone(doc, s.x, s.y, 22.5).lineWidth(1.88).fillAndStroke(P.orange, "#ffffff");
    else hexagone(doc, s.x, s.y, 22.5).fill("#ffffff");
    icone(doc, s.ic, s.x, s.y, s.plein ? "#ffffff" : P.bleu);
    texte(doc, s.label, s.x, s.y + 26.3, { f: I7, s: 9, c: "#ffffff" }, "c");
  }
  for (const s of SLOTS_COUV) {
    hexagone(doc, s.cx, s.cy, 66).fill("#ffffff");
    photoHex(doc, s.f, s.cx, s.cy, 63, s.rect);
  }
  hexagone(doc, 297.75, 288, 90).fill(P.orange);
  photoHex(doc, "famille", 297.75, 288, 84, [213, 204, 382.5, 372]);
  for (const s of SLOTS_COUV) {
    const st = { f: I7, s: 9, c: "#ffffff" };
    const w = largeur(doc, s.label, st) + 15.2;
    doc.rect(s.cx - w / 2, s.cy + 34.5, w, 15.75).fill(P.marine);
    texte(doc, s.label, s.cx, s.cy + 37.6, st, "c");
  }
  doc.rect(0, 498, 447, 6).fill(P.orange);
  doc.rect(447, 498, W - 447, 6).fill(P.bleu);

  // Titre
  texte(doc, "ASSURANCE SANTÉ · TOUTES BRANCHES", 42, 526.8, { f: M7, s: 9.75, c: P.orangeTexte, ls: 2.19 });
  texte(doc, "Réseau de Soins", 42, 541.9, { f: M9, s: 36, c: P.marine, ls: -0.7 });
  texte(doc, "Conventionné", 42, 579.4, { f: M9, s: 36, c: P.marine, ls: -0.7 });
  texte(doc, "Classement par Province et Ville", 42, 629, { f: I5, s: 13.5, c: P.bleu, ls: 0.11 });

  const cartes: [string, string, string, string][] = [
    [String(ctx.total), "PRESTATAIRES", P.bleu, P.bleu],
    [String(ctx.nbProvs), "PROVINCES", P.orange, P.orangeChiffre],
    [String(ctx.nbVilles), "VILLES", P.marine, P.marine],
  ];
  cartes.forEach(([val, label, barre, coul], i) => {
    const x = 42 + i * 174.75;
    doc.rect(x + 0.375, 662.625, 162, 63).lineWidth(0.75).stroke(P.bord);
    doc.rect(x, 662.25, 162.75, 3.75).fill(barre);
    texte(doc, val, x + 14.2, 671.4, { f: M8, s: 28.5, c: coul });
    texte(doc, label, x + 14.2, 705.8, { f: I6, s: 9, c: P.gris, ls: 1.1 });
  });

  doc.rect(0, 797.25, W, doc.page.height - 797.25).fill(P.marine);
  texte(doc, ctx.nomMaj, 42, 813.3, { f: M8, s: 10.5, c: "#ffffff", ls: 0.3 });
  texte(doc, "Hôpitaux · Cliniques · Cabinets · Laboratoires · Pharmacies · Optique", 553.5, 815.3, { f: I4, s: 9, c: P.texteBande }, "d");
}

// ── Page 2 : statistiques ───────────────────────────────────────────────────
function statistiques(ctx: Ctx) {
  const { doc, P, provinces, total } = ctx;
  enteteSociete(ctx, "Statistiques du réseau", "RÉSEAU DE SOINS CONVENTIONNÉ", 27.6);
  doc.rect(36, 73.5, 523.5, 1.5).fill(P.bleu);

  const boites: [string, string, string, string, string, number][] = [
    ["st_prestataires", String(total), "PRESTATAIRES", P.bleu, "#ffffff", 36],
    ["st_provinces", String(ctx.nbProvs), "PROVINCES", P.marine, P.orange, 213.75],
    ["st_villes", String(ctx.nbVilles), "VILLES", P.orange, P.marine, 392.25],
  ];
  for (const [ic, val, label, fond, coulIc, x] of boites) {
    const texteC = fond === P.orange ? P.marine : "#ffffff";
    doc.rect(x, 91.5, 167.5, 59.25).fill(fond);
    icone(doc, ic, x + 28.5, 121.4, coulIc);
    texte(doc, val, x + 54, 99.1, { f: M8, s: 27, c: texteC });
    texte(doc, label, x + 54, 129.5, { f: I7, s: 9, c: texteC, ls: 1.08 });
  }

  titreSection(ctx, "Répartition par province et par ville", 166.9);
  const yT = 189.4;
  doc.rect(36.75, yT + 0.4, 522, 23.2).fill(P.bleu);
  const hst = { f: I7, s: 9, c: "#ffffff", ls: 0.75 };
  texte(doc, "PROVINCE · VILLES", 47.2, yT + 6.8, hst);
  texte(doc, "VILLES", 299.2, yT + 6.8, hst, "c");
  texte(doc, "PRESTATAIRES", 368.2, yT + 6.8, hst, "c");
  texte(doc, "RÉPARTITION", 413.2, yT + 6.8, hst);
  let y = yT + 23.6;
  provinces.forEach((prov, i) => {
    const nb = prov.villes.reduce((s, v) => s + v.prestataires.length, 0);
    doc.rect(36.75, y, 522, 33.75).fill(i % 2 ? P.zebra : "#ffffff");
    doc.rect(36.75, y, 522, 0.75).fill(P.sep);
    texte(doc, prov.nom, 47.2, y + 5.6, { f: M7, s: 9.75, c: P.marine });
    const villes = tronquer(doc, prov.villes.map((v) => `${v.nom} ${v.prestataires.length}`).join(" · "), { f: I4, s: 9, c: P.grisClair }, 225);
    texte(doc, villes, 47.2, y + 18.8, { f: I4, s: 9, c: P.grisClair });
    texte(doc, String(prov.villes.length), 299.2, y + 12.2, { f: I5, s: 9.75, c: P.gris }, "c");
    texte(doc, String(nb), 368.2, y + 10.9, { f: M8, s: 11.25, c: P.bleu }, "c");
    doc.rect(413.25, y + 13.5, 97.5, 7.5).fill(P.piste);
    const wb = total ? (nb / total) * 97.5 : 0;
    if (wb > 0) doc.rect(413.25, y + 13.5, Math.max(wb, 1.5), 7.5).fill(P.orange);
    texte(doc, pct(nb, total), 548.2, y + 12.8, { f: I4, s: 9, c: P.gris }, "d");
    y += 33.75;
  });
  doc.rect(36.75, y, 522, 24).fill(P.marine);
  const tst = { f: I7, s: 9.75, c: "#ffffff" };
  texte(doc, "TOTAL", 47.2, y + 6.9, tst);
  texte(doc, String(ctx.nbVilles), 299.2, y + 6.9, tst, "c");
  texte(doc, String(total), 368.2, y + 6.9, tst, "c");
  texte(doc, "100 %", 413.2, y + 6.9, tst);
  y += 24.3;
  doc.rect(36.375, yT, 522.75, y - yT).lineWidth(0.75).stroke(P.bord);

  // Répartition par type
  const yS = y + 16.5;
  titreSection(ctx, "Répartition par type de prestataire", yS);
  const compte = new Map<InfoType, number>();
  for (const p of provinces) for (const v of p.villes) for (const pr of v.prestataires) {
    const t = infoType(pr.type); compte.set(t, (compte.get(t) ?? 0) + 1);
  }
  const types = [...compte.entries()].sort((a, b) => b[1] - a[1] || TYPES.indexOf(a[0]) - TYPES.indexOf(b[0]));
  const stL = { f: I6, s: 9, c: P.gris };
  let yc = yS + 22.5;
  for (let r = 0; r < types.length; r += 3) {
    const ligne = types.slice(r, r + 3).map(([t, n]) => ({ t, n, lignes: couper(doc, t.pluriel, stL, 95) }));
    const h = ligne.some((c) => c.lignes.length > 1) ? 52.5 : 48.75;
    ligne.forEach(({ t, n, lignes }, j) => {
      const x = 36.4 + j * 177;
      const cy = yc + h / 2;
      doc.rect(x, yc, 168.7, h).lineWidth(0.75).stroke(P.bord);
      hexagone(doc, x + 25.9, cy, 16.5).fill((r + j) % 2 ? P.bleu : P.orange);
      icone(doc, t.icone, x + 25.9, cy, "#ffffff");
      const yn = cy - (lignes.length > 1 ? 21.9 : 16);
      texte(doc, String(n), x + 51.4, yn, { f: M8, s: 16.5, c: P.marine });
      lignes.forEach((l, k) => texte(doc, l, x + 51.4, yn + 19.5 + k * 11.6, stL));
    });
    yc += h + 8.25;
  }
  piedStats(ctx, "Réseau de Soins Conventionné", `${pl(total, "prestataire")} · ${pl(ctx.nbVilles, "ville")} · ${pl(ctx.nbProvs, "province")}`, "02");
}

// ── Page 3 : carte ──────────────────────────────────────────────────────────
const GRAND_LIBREVILLE = ["Libreville", "Akanda", "Owendo", "Ntoum"];
const SEUILS: [number, keyof Palette][] = [[100, "b5"], [30, "b4"], [20, "b3"], [10, "b2"], [1, "b1"]];
const couleurClasse = (P: Palette, n: number) => { const s = SEUILS.find(([m]) => n >= m); return s ? P[s[1]] : "#eef2f7"; };

function carte(ctx: Ctx) {
  const { doc, P, provinces } = ctx;
  const { carte: geo } = res();
  enteteSociete(ctx, "Le réseau sur la carte du Gabon", `${pl(ctx.nbProvs, "PROVINCE", "PROVINCES")} · ${pl(ctx.nbVilles, "VILLE", "VILLES")} · ${pl(ctx.total, "PRESTATAIRE", "PRESTATAIRES")}`, 27.6);
  doc.rect(36, 73.5, 523.5, 1.5).fill(P.bleu);

  const nbProv = new Map(provinces.map((p) => [p.nom, p.villes.reduce((s, v) => s + v.prestataires.length, 0)]));
  for (const [nom, pv] of Object.entries(geo.provinces)) {
    doc.path(pv.d).lineWidth(1.54).lineJoin("round").fillAndStroke(couleurClasse(P, nbProv.get(nom) ?? 0), "#ffffff");
  }
  for (const [nom, pv] of Object.entries(geo.provinces)) {
    const n = nbProv.get(nom) ?? 0, fond = couleurClasse(P, n);
    const c = fond === P.b5 || fond === P.b4 ? "#ffffff" : fond === P.b3 || fond === P.b2 ? P.marine : P.labelClair;
    const [x, y, s] = pv.label;
    texte(doc, nom.toUpperCase(), x, y, { f: M8, s, c, ls: 0.4 }, "c");
    texte(doc, String(n), x, y + 9.7, { f: I6, s: 7.7, c }, "c");
  }

  // Villes
  const rayon = (n: number) => 3.11 + 0.83 * Math.sqrt(n);
  const position = (v: VilleAnnuaire) => {
    const connue = geo.villes[v.nom];
    if (connue) return connue;
    const pts = v.prestataires.filter((p) => p.latitude != null && p.longitude != null);
    if (!pts.length) return null;
    const lat = pts.reduce((s, p) => s + p.latitude!, 0) / pts.length, lon = pts.reduce((s, p) => s + p.longitude!, 0) / pts.length;
    const [ax, bx, cx] = geo.projection.x, [ay, by, cy] = geo.projection.y;
    return { x: ax * lon + bx * lat + cx, y: ay * lon + by * lat + cy, cote: "d" as const };
  };
  const villesEstuaire = provinces.find((p) => p.nom === "Estuaire")?.villes ?? [];
  const glv = GRAND_LIBREVILLE.map((n) => villesEstuaire.find((v) => v.nom === n)).filter((v): v is VilleAnnuaire => !!v);
  const etiq: { nom: string; n: number; x: number; y: number; r: number; cote: "d" | "g" }[] = [];
  for (const prov of provinces) for (const v of prov.villes) {
    if (glv.includes(v)) continue;
    const pos = position(v);
    if (!pos) continue;
    const r = rayon(v.prestataires.length);
    doc.save().circle(pos.x, pos.y, r).lineWidth(1.15).fillOpacity(0.92).fillAndStroke(P.orange, "#ffffff").restore();
    etiq.push({ nom: v.nom, n: v.prestataires.length, x: pos.x, y: pos.y, r, cote: pos.cote });
  }
  // Grand Libreville : un grand point + points secondaires et encadré
  if (glv.length) {
    const lbv = glv.find((v) => v.nom === "Libreville");
    if (lbv) doc.save().circle(143.8, 231.8, rayon(lbv.prestataires.length)).lineWidth(1.15).fillOpacity(0.92).fillAndStroke(P.orange, "#ffffff").restore();
    for (const v of glv) {
      if (v === lbv) continue;
      const g = geo.villes[v.nom];
      doc.circle(g.x, g.y, v.prestataires.length >= 10 ? 3.05 : 2.69).lineWidth(0.92).fillAndStroke(P.orange, P.marine);
    }
    const stN = { f: I6, s: 8.47, c: P.marine }, stC = { f: I7, s: 8.47, c: P.orangeTexte };
    const items = glv.map((v) => [v.nom, String(v.prestataires.length)] as [string, string]);
    const lignes: [string, string][][] = [];
    for (const it of items) {
      const cur = lignes[lignes.length - 1];
      const w = cur ? cur.reduce((s, [a, b]) => s + largeur(doc, `${a} ${b} · `, stN), 0) + largeur(doc, `${it[0]} ${it[1]}`, stN) : 0;
      if (!cur || lignes.length === 1 || w > 95) lignes.push([it]); else cur.push(it);
    }
    const hBox = 21.6 + (lignes.length + 1) * 12.3;
    doc.moveTo(105.3, 100.9 + hBox).lineTo(133, 219.5).lineWidth(0.92).stroke(P.marine);
    doc.rect(37.5, 100.9, 101.7, hBox).lineWidth(0.92).fillAndStroke("#ffffff", P.marine);
    doc.rect(37.5, 100.9, 101.7, 16.9).fill(P.marine);
    texte(doc, "GRAND LIBREVILLE", 43.7, 105, { f: M8, s: 7.7, c: "#ffffff", ls: 0.55 });
    lignes.forEach((l, i) => {
      const parts: [string, StyleTexte][] = [];
      l.forEach(([nom, n], k) => { if (k) parts.push([" · ", stN]); parts.push([`${nom} `, stN], [n, stC]); });
      morceaux(doc, parts, 43.7, 122.5 + i * 12.3);
    });
    texte(doc, pl(glv.reduce((s, v) => s + v.prestataires.length, 0), "prestataire"), 43.7, 122.5 + lignes.length * 12.3, { f: I4, s: 6.92, c: P.grisClair });
  }
  for (const e of etiq) {
    const stN = { f: I6, s: 8.47, c: P.marine }, stC = { f: I7, s: 8.47, c: P.orangeTexte };
    const w = largeur(doc, `${e.nom} `, stN) + largeur(doc, String(e.n), stC);
    const x = e.cote === "d" ? e.x + e.r + 1.8 : e.x - e.r - 1.6 - w, y = e.y - 5.8;
    doc.save().lineWidth(2.4).lineJoin("round").strokeColor("#ffffff");
    texte(doc, `${e.nom} ${e.n}`, x, y, stN, "g", { stroke: true });
    doc.restore();
    morceaux(doc, [[`${e.nom} `, stN], [String(e.n), stC]], x, y);
  }
  icone(doc, "nord", 513.3, 109.35, P.marine);
  texte(doc, "N", 513.3, 119.7, { f: M8, s: 9.23, c: P.marine }, "c");

  // Légende
  doc.rect(36.375, 561.375, 522.75, 54).lineWidth(0.75).fillAndStroke(P.zebra, P.bord);
  texte(doc, "Prestataires par province", 47.2, 570.1, { f: I6, s: 9, c: P.marine });
  (["b1", "b2", "b3", "b4", "b5"] as const).forEach((k, i) => doc.rect(163.5 + i * 19.5, 570.75, 19.5, 9).fill(P[k]));
  texte(doc, "1–9 · 10–19 · 20–29 · 30–99 · 100+", 267.3, 570.1, { f: I4, s: 9, c: P.gris });
  doc.circle(51.75, 601.5, 3.75).fill(P.orange);
  doc.circle(67.5, 599.25, 7.5).fill(P.orange);
  morceaux(doc, [["Ville du réseau", { f: I6, s: 9, c: P.marine }], [" — taille selon le nombre de prestataires", { f: I4, s: 9, c: P.gris }]], 83.2, 594.8);

  const toutes = [...Object.keys(geo.provinces)].sort((a, b) => ordreProv(a) - ordreProv(b));
  toutes.forEach((nom, i) => {
    const x = 36.375 + (i % 3) * 176.6, y = 628.1 + Math.floor(i / 3) * 30;
    const n = nbProv.get(nom) ?? 0;
    doc.rect(x, y, 169.5, 23.25).lineWidth(0.75).stroke(P.bord);
    doc.rect(x + 7.85, y + 6.4, 10.5, 10.5).fill(couleurClasse(P, n));
    doc.rect(x + 8.2, y + 6.8, 9.75, 9.75).lineWidth(0.75).stroke(P.bordPastille);
    texte(doc, nom, x + 25.8, y + 7.2, { f: I6, s: 9, c: P.marine });
    texte(doc, String(n), x + 161.8, y + 5.2, { f: M8, s: 10.5, c: P.bleu }, "d");
  });
  piedStats(ctx, "Carte indicative, positions des villes approximatives", "Fond de carte : Natural Earth", "03");
}
const ORDRE = ["Estuaire", "Ogooué-Maritime", "Haut-Ogooué", "Ngounié", "Woleu-Ntem", "Nyanga", "Ogooué-Lolo", "Moyen-Ogooué", "Ogooué-Ivindo"];
const ordreProv = (n: string) => { const i = ORDRE.indexOf(n); return i < 0 ? 99 : i; };

// ── Pages 4+ : annuaire ─────────────────────────────────────────────────────
const COLS = [36, 210.75, 307.5, 460.5, 559.5];
const BAS = 801.75;
const ST_NOM = { f: I7, s: 9, c: "" }, ST_ADR = { f: I4, s: 9, c: "" }, ST_TEL = { f: I7, s: 9, c: "" }, ST_BADGE = { f: I6, s: 9, c: "" };

interface LigneAnnuaire { p: PrestataireAnnuaire; t: InfoType; nom: string[]; adr: string[]; tels: string[]; badge: string[]; h: number }

function preparerLigne(doc: Doc, p: PrestataireAnnuaire): LigneAnnuaire {
  const t = infoType(p.type);
  const nom = couper(doc, p.nom, ST_NOM, 161.5);
  const adr = p.adresse?.trim() ? couper(doc, p.adresse.trim(), ST_ADR, 141) : ["—"];
  const tels = (p.telephone || "").split(/\s*[\/;,|·]\s*|\s{2,}|\n/).map((s) => s.trim()).filter(Boolean);
  const badge = couper(doc, t.badge, ST_BADGE, 66.5);
  // Hauteurs moyennes mesurées sur le modèle : 21,8 + 12,2 par ligne au-delà de la 1re.
  const n = Math.max(nom.length, adr.length, tels.length);
  return { p, t, nom, adr, tels: tels.length ? tels : ["—"], badge, h: Math.max(24.4, 21.8 + (n - 1) * 12.2, badge.length > 1 ? 36.1 : 0) };
}

function annuaire(ctx: Ctx) {
  const { doc, P } = ctx;
  // En-tête de la première page
  enteteSociete(ctx, "Annuaire des prestataires", "CLASSEMENT PAR PROVINCE ET VILLE", 34.3);
  doc.rect(36, 80.25, 523.5, 1.5).fill(P.bleu);
  const bandeau: [string, number, [number, number, number, number], string][] = [
    ["hopitaux", 36, [32.2, 95.25, 209.2, 192.75], P.bleu],
    ["consultations", 213, [207.8, 95.25, 399, 192.75], P.orange],
    ["pharmacies", 390, [386.2, 95.25, 563.2, 192.75], P.marine],
  ];
  for (const [f, x, r, barre] of bandeau) {
    doc.save().rect(x, 95.25, 169.5, 97.5).clip();
    doc.image(photo(f), r[0], r[1], { width: r[2] - r[0], height: r[3] - r[1] });
    doc.restore();
    doc.rect(x, 192.75, 169.5, 3.75).fill(barre);
  }
  // Légende des types présents
  const presents = new Set<InfoType>();
  for (const p of ctx.provinces) for (const v of p.villes) for (const pr of v.prestataires) presents.add(infoType(pr.type));
  let lx = 36 + texte(doc, "Légende :", 36, 212.7, { f: I6, s: 9, c: P.gris }) + 9.2, ly = 210;
  for (const t of TYPES.filter((x) => presents.has(x))) {
    const st = { f: I6, s: 9, c: t.c };
    const w = 16.3 + largeur(doc, t.badge, st) + 6.8;
    if (lx + w > 559.5) { lx = 36; ly += 20.25; }
    doc.rect(lx, ly, w, 15.75).fill(t.fond);
    losange(doc, lx + 9.4, ly + 7.9, 3.7, t.c);
    texte(doc, t.badge, lx + 16.3, ly + 3.1, st);
    lx += w + 6;
  }
  let y = ly + 15.75 + 21;

  const sautPage = () => { doc.addPage(); y = 33.75; };
  const enteteTableau = () => {
    for (let i = 0; i < 4; i++) doc.rect(COLS[i], y, COLS[i + 1] - COLS[i], 20.25).fill(P.piste);
    const st = { f: I7, s: 9, c: P.marine, ls: 0.39 };
    texte(doc, "PRESTATAIRE", 43.5, y + 5, st);
    texte(doc, "TYPE", 216.9, y + 5, st);
    texte(doc, "ADRESSE", 313.2, y + 5, st);
    texte(doc, "TÉLÉPHONE", 468, y + 5, st);
    y += 20.25;
  };

  ctx.provinces.forEach((prov, ip) => {
    const nbP = prov.villes.reduce((s, v) => s + v.prestataires.length, 0);
    prov.villes.forEach((ville, iv) => {
      const lignes = [...ville.prestataires]
        .sort((a, b) => TYPES.indexOf(infoType(a.type)) - TYPES.indexOf(infoType(b.type)) || (a.nom.toUpperCase() < b.nom.toUpperCase() ? -1 : a.nom.toUpperCase() > b.nom.toUpperCase() ? 1 : 0))
        .map((p) => preparerLigne(doc, p));
      // Bandeau province + barre ville + en-tête + 1re ligne restent ensemble
      const ecart = iv > 0 ? 7.5 : ip > 0 ? 21 : 0;
      const besoin = ecart + (iv === 0 ? 33 + 7.5 : 0) + 24.75 + 3 + 20.25 + lignes[0].h;
      if (y + besoin > BAS) sautPage();
      else y += ecart;
      if (iv === 0) {
        doc.rect(36, y, 523.5, 33).fill(P.orange);
        hexagone(doc, 54.75, y + 16.5, 6.7).fill(P.marine);
        texte(doc, prov.nom.toUpperCase(), 69, y + 7.2, { f: M9, s: 15, c: P.marine });
        texte(doc, `${pl(nbP, "prestataire")} — ${pl(prov.villes.length, "ville")}`, 547.1, y + 11, { f: I7, s: 9.75, c: P.marine }, "d");
        y += 33 + 7.5;
      }
      doc.rect(36, y, 523.5, 24.75).fill(P.bleu);
      icone(doc, "pin_ville", 51.75, y + 12.4, "#ffffff");
      texte(doc, ville.nom, 63, y + 5.6, { f: M8, s: 11.25, c: "#ffffff" });
      texte(doc, pl(ville.prestataires.length, "prestataire"), 549, y + 7.6, { f: I7, s: 9, c: "#ffffff" }, "d");
      y += 24.75 + 3;
      enteteTableau();
      lignes.forEach((l, i) => {
        if (y + l.h > BAS) { sautPage(); enteteTableau(); }
        const fond = i % 2 ? P.zebra : "#ffffff";
        for (let c = 0; c < 4; c++) doc.rect(COLS[c], y, COLS[c + 1] - COLS[c], l.h).fill(fond);
        doc.rect(36, y + l.h - 0.75, 523.5, 0.75).fill(P.sep);
        l.nom.forEach((s, k) => texte(doc, s, 43.5, y + 5 + k * 12.6, { ...ST_NOM, c: P.marine }));
        const hb = l.badge.length > 1 ? 26.25 : 15;
        const wb = l.badge.length > 1 ? 84.7 : 18.5 + largeur(doc, l.badge[0], ST_BADGE);
        doc.rect(216.75, y + 4.5, wb, hb).fill(l.t.fond);
        losange(doc, 224.25, y + 4.5 + hb / 2, 3.15, l.t.c);
        l.badge.forEach((s, k) => texte(doc, s, 230.4, y + 6.8 + k * 12, { ...ST_BADGE, c: l.t.c }));
        l.adr.forEach((s, k) => texte(doc, s, 313.2, y + 5.1 + k * 12.6, { ...ST_ADR, c: s === "—" ? "#9aa5b5" : P.gris }));
        l.tels.forEach((s, k) => texte(doc, s, 468, y + 5.3 + k * 12, { ...ST_TEL, c: s === "—" ? "#9aa5b5" : P.bleu }));
        y += l.h;
      });
    });
  });

  // Ligne de synthèse finale
  if (y + 22.4 + 20 > BAS) sautPage(); else y += 22.4;
  doc.rect(36, y, 523.5, 0.75).fill(P.bord);
  morceaux(doc, [[ctx.nomMaj, { f: I7, s: 9, c: P.marine }], [" — Réseau de Soins Conventionné", { f: I4, s: 9, c: P.grisClair }]], 36, y + 8.8);
  texte(doc, `${pl(ctx.total, "prestataire")} · ${pl(ctx.nbVilles, "ville")} · ${pl(ctx.nbProvs, "province")}`, 559.5, y + 9.1, { f: I4, s: 9, c: P.grisClair }, "d");
}

function losange(doc: Doc, cx: number, cy: number, r: number, c: string) {
  doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]).fill(c);
}

// ── Dernière page : 4e de couverture ────────────────────────────────────────
function quatriemeCouverture(ctx: Ctx) {
  const { doc, P, soc } = ctx;
  const W = doc.page.width, H = doc.page.height;
  doc.rect(0, 0, W, H).fill(P.hero);
  grilleHex(doc, 0, 0, W, H, 22.5, 38.75);
  doc.polygon([-22.5, 105], [29.46, 135], [29.46, 195], [-22.5, 225]).fill(P.orange);
  doc.polygon([W + 0.2, 615], [W + 0.2 - 37.67, 636.75], [W + 0.2 - 37.67, 680.25], [W + 0.2, 702]).fill(P.bleu);

  const stH = { f: M7, s: 9.75, c: "#ffffff", ls: 2.18 };
  const wH = largeur(doc, "RÉSEAU DE SOINS CONVENTIONNÉ", stH) + 2.18;
  texte(doc, "RÉSEAU DE SOINS CONVENTIONNÉ", W / 2 - wH / 2, 39.3, stH);
  doc.rect(W / 2 - wH / 2 - 4.25 - 30, 43.5, 30, 3).fill(P.orange);
  doc.rect(W / 2 + wH / 2 + 4.25, 43.5, 30, 3).fill(P.orange);

  const hexs: [string, number, number, string, [number, number, number, number]][] = [
    ["hospitalisation", 150.75, 183, "#ffffff", [37.5, 108.8, 275.2, 257.2]],
    ["imagerie", 297.75, 183, P.orange, [180, 108.8, 405.8, 257.2]],
    ["laboratoires", 444.75, 183, "#ffffff", [298.5, 108.8, 591, 257.2]],
    ["consultations", 224.25, 307.5, P.bleu, [127.5, 233.2, 419.2, 381.8]],
    ["famille", 371.25, 307.5, "#ffffff", [296.2, 233.2, 446.2, 381.8]],
  ];
  for (const [f, cx, cy, bord, r] of hexs) {
    hexagone(doc, cx, cy, 78).fill(bord);
    photoHex(doc, f, cx, cy, 74.25, r);
  }

  doc.rect(194.25, 417, 207, 94.5).fill("#ffffff");
  if (!logoDans(doc, ctx.logo, W / 2, 464.25, 180, 67.5, "c")) texte(doc, ctx.nomMaj, W / 2, 456, { f: M8, s: 16, c: P.marine }, "c");

  texte(doc, `${soc.sousTitre || "Courtier d'Assurances"} · Assurance Santé`, W / 2, 527.8, { f: M8, s: 16.5, c: "#ffffff" }, "c");
  texte(doc, `${pl(ctx.total, "prestataire conventionné", "prestataires conventionnés")} · ${pl(ctx.nbVilles, "ville")} · ${pl(ctx.nbProvs, "province")}`, W / 2, 567.2, { f: I4, s: 10.5, c: P.texteBande }, "c");

  const adresse = [soc.adresse, soc.boitePostale, soc.ville].map((s) => s?.trim()).filter(Boolean).join(", ");
  const contacts: [string, string | null | undefined, number, number][] = [
    ["ct_adresse", adresse, 54.375, 604.875], ["ct_telephone", soc.telephone, 302.625, 604.875],
    ["ct_email", soc.email, 54.375, 649.875], ["ct_web", soc.siteWeb, 302.625, 649.875],
  ];
  const stC = { f: I4, s: 10.5, c: "#ffffff" };
  for (const [ic, val, x, y] of contacts) {
    doc.rect(x, y, 238.5, 35.25).lineWidth(0.75).stroke(P.bordContact);
    icone(doc, ic, x + 19.1, y + 17.5, P.orange);
    texte(doc, tronquer(doc, val?.trim() || "—", stC, 190), x + 36.4, y + 12.6, stC);
  }
  doc.rect(0, 834.75, 447, H - 834.75).fill(P.orange);
  doc.rect(447, 834.75, W - 447, H - 834.75).fill(P.bleu);
}

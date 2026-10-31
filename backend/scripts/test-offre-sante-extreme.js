// Test de résistance du moteur « Offre santé » (2026-10-31) : une offre
// aux contenus extrêmes — client, compagnies et territorialités très longs,
// 7 compagnies (comparatif paysage), 20 options pour une compagnie, mot sans
// espace plus large qu'une colonne, cellule de plus d'une page… — doit se
// générer sans qu'aucun texte ne sorte de la feuille.
// Usage (depuis backend/, après `npx nest build`) :
//   node scripts/test-offre-sante-extreme.js [sortie.pdf]
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { genererCorpsOffre, pdfVersBuffer } = require(process.env.MOTEUR || "../dist/src/documents/offre-sante.pdf");

const long = (mot, n) => Array.from({ length: n }, (_, i) => `${mot} ${i + 1}`).join(", ");
const URL_LONGUE = "https://www.compagnie-exemple-aux-conditions-tres-longues.ga/conditions-generales-sante-2027.pdf";
const TERRITOIRE = `GABON, PAYS CIMA (${long("PAYS", 30)}), UNION EUROPEENNE, AFRIQUE DU SUD, MAROC, TUNISIE, TURQUIE, EMIRATS ARABES UNIS`;

const tableauColonnes = {
  style: "colonnes", territorialite: TERRITOIRE, titreColonneGaranties: "GARANTIES DE LA COMPAGNIE INTERNATIONALE DES ASSURANCES",
  titreColonneTaux: "TAUX (privé / public / étranger)",
  sections: [
    { titre: "1) Médecine courante et spécialisée " + long("acte", 10), lignes: [
      { libelle: "Consultations " + long("spécialité", 25), taux: "80% / 100% / 70% selon zone géographique", plafond: "Frais réels " + long("condition", 40) },
      { libelle: "Ligne gigantesque", taux: "80%", plafond: Array.from({ length: 140 }, (_, i) => `Clause ${i + 1} : remboursement selon barème`).join("\n") },
      { libelle: URL_LONGUE, taux: "100%", plafond: URL_LONGUE },
    ] },
    ...Array.from({ length: 6 }, (_, k) => ({ titre: `Rubrique ${k + 1}`, lignes: Array.from({ length: 8 }, (_, i) => ({ libelle: `Garantie ${k}.${i} ${long("mot", 3)}`, taux: "100%", plafond: `${(i + 1) * 100000} F CFA / AN` })) })),
  ],
  piedTableau: "LE PLAFOND PAR FAMILLE EST FIXE A " + long("MILLIONS", 12),
};
const tableauGrille = {
  style: "grille", territorialite: TERRITOIRE, tauxAmbulatoire: "80%", tauxHospitalisation: "100%",
  titreCollege: "TABLEAU DE GARANTIES COLLEGE CADRES SUPERIEURS, AGENTS DE MAITRISE, OUVRIERS ET RETRAITES DU GROUPE",
  sections: [
    { titre: "CONSULTATION / DIVERS " + long("sous-rubrique", 20), plafondCommun: "BAREME TARIFAIRE " + long("précision", 30),
      lignes: Array.from({ length: 12 }, (_, i) => ({ libelle: `Acte ${i + 1} ${long("détail", 4)}`, taux: "80% / 100% / 90% hors réseau conventionné" })) },
    { titre: "LIGNE PLUS HAUTE QU'UNE PAGE", lignes: [{ libelle: "Énorme", taux: "100%", plafond: Array.from({ length: 160 }, (_, i) => `Condition ${i + 1}`).join("\n") }] },
    ...Array.from({ length: 8 }, (_, k) => ({ titre: `RUBRIQUE ${k + 1}`, lignes: Array.from({ length: 6 }, (_, i) => ({ libelle: `Ligne ${i}`, taux: "100%", plafond: URL_LONGUE })) })),
  ],
  piedTableau: "LE PLAFOND PAR FAMILLE EST FIXE A VINGT MILLIONS DE F CFA (20 000 000) PAR AN",
};

const contenu = (i, tableau) => ({
  titre: [`PROPOSITION SANTE OPTION ${i} : ${TERRITOIRE}`, "80% Ambulatoires &", "100 % hospitalisations"],
  designationRecap: [`Maladie option ${i} : ${TERRITOIRE.slice(0, 160)}`], libelleComparatif: `Option ${i} - ${TERRITOIRE.slice(0, 120)}`,
  population: 1234, garanties: Array.from({ length: 40 }, (_, k) => `Garantie ${k + 1} ${long("détail", 5)}`),
  limites: Array.from({ length: 30 }, (_, k) => ({ texte: `Limite ${k + 1} : ${long("condition", 8)} ${URL_LONGUE}`, detail: k % 3 ? null : long("précision", 10) })),
  mentionsFraisReels: true, tableau, primeParPersonne: 987654321, primeCommuniquee: i % 2 ? 999999999 : null, primeNonCommuniquee: i === 3,
});
const cotation = (i, tableau, branche = "Maladie") => ({
  branche, contenu: branche === "Assistance" ? { ...contenu(i, null), titre: [], garanties: [], limites: [] } : contenu(i, tableau),
  primeNette: 123456789012, cartes: 3085000, accessoires: 50000, taxe: 9876543210, ttc: 999999999999, tauxTaxe: 8,
});
const NOMS = ["COMPAGNIE INTERNATIONALE D'ASSURANCES ET DE REASSURANCES DU GOLFE DE GUINEE", "AXA", "OGAR", "NSIA", "SUNU", "SANLAM ALLIANZ", "ASSUREUR SANS ESPACE" + "X".repeat(60)];
const donnees = {
  clientNom: "SOCIETE D'EXPLOITATION DES ENERGIES RENOUVELABLES ET DE DISTRIBUTION D'EAU POTABLE DU GABON (SEERDEPG) - DIRECTION GENERALE",
  clientLogo: null, societeLogo: null,
  params: {
    titreDocument: "OFFRES SANTES 2027", exercice: "EXERCICE 2026", date: "le 31 Octobre 2026", redacteur: ["LA RUCHE EXCELLENCE", "7153 LIBREVILLE"],
    chargeClientele: "Lekogo Oscar", telephone: "011 72 94 91", telecopie: "", adresseAssure: "Libreville/ Gabon", periode: "du 01.01.2027 au 31.12.2027",
    duree: "Un an", mentionSignature: "POUR LA RUCHE EXCELLENCE SA", lieuSignature: "Libreville", pagesPresentation: false, annexeReseau: false,
  },
  compagnies: NOMS.map((nom, k) => ({
    nom, logo: null, logoPetit: null,
    cotations: k === 0
      ? Array.from({ length: 20 }, (_, i) => cotation(i, i % 2 ? tableauGrille : tableauColonnes, i === 5 ? "Assistance" : "Maladie"))
      : [cotation(k, k % 2 ? tableauGrille : tableauColonnes), cotation(k + 100, null, "Assistance")],
  })),
};

(async () => {
  const doc = new PDFDocument({ size: [596.52, 842.52], margin: 0, bufferPages: true });
  // Chaque texte posé est contrôlé : il doit tenir dans la feuille (marge 8 pt).
  const erreurs = [];
  let page = 1;
  doc.on("pageAdded", () => page++);
  const text = doc.text.bind(doc);
  doc.text = (txt, x, y, opts) => {
    const w = doc.widthOfString(String(txt)), W = doc.page.width, H = doc.page.height;
    if (x < 8 || x + w > W - 8 || y < 8 || y > H - 8) erreurs.push(`page ${page} : « ${String(txt).slice(0, 50)} » x=${x.toFixed(0)} w=${w.toFixed(0)} y=${y.toFixed(0)} (page ${W.toFixed(0)}×${H.toFixed(0)})`);
    return text(txt, x, y, opts);
  };
  const pPdf = pdfVersBuffer(doc);
  const dernier = genererCorpsOffre(doc, donnees);
  const pages = doc.bufferedPageRange().count;
  doc.end();
  const pdf = await pPdf;
  if (process.argv[2]) fs.writeFileSync(process.argv[2], pdf);
  console.log(`${pages} pages, dernier numéro ${dernier}, ${Math.round(pdf.length / 1024)} Ko`);
  if (erreurs.length) {
    console.error(`ÉCHEC : ${erreurs.length} texte(s) hors de la feuille`);
    erreurs.slice(0, 30).forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("OK : aucun texte hors de la feuille.");
})().catch((e) => { console.error(e); process.exit(1); });

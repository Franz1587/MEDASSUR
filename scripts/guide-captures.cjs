// Captures d'écran du Guide d'utilisateur, rejouables : npm run guide:captures -- [préfixe]
// Prérequis : backend (:3001) et frontend (:5173) lancés en local.
// Identifiants lus dans l'environnement, jamais écrits ici :
//   GUIDE_EMAIL / GUIDE_MDP (compte interne), GUIDE_URL (défaut http://localhost:5173).
// Les PNG sont écrits dans backend/assets/guide/ (servis par /api/guide-assets/).
// Après une capture, mettre à jour le texte du chapitre et sa date `majLe`.
const path = require("path");
const { chromium } = require("playwright-core");

const SORTIE = path.resolve(__dirname, "../backend/assets/guide");
const URL = process.env.GUIDE_URL ?? "http://localhost:5173";

// Une capture = un écran du menu + des actions simples, puis une photo.
// Actions : { clic: "texte" } | { dblclic: "texte" } | { role: "button", nom: "Répondre" }
//           | { saisir: "libellé du champ", texte: "…" } | { attendre: ms } | { touche: "Escape" }
const CAPTURES = [
  { fichier: "communications-01-boite.png", ecran: "Communications" },
  { fichier: "communications-02-lecture.png", ecran: "Communications", actions: [{ premierMessage: true }] },
  { fichier: "communications-03-fenetre.png", ecran: "Communications", actions: [{ premierMessage: true, double: true }] },
  { fichier: "communications-04-redaction.png", ecran: "Communications", actions: [{ role: "button", nom: "Nouveau courrier" }] },
  { fichier: "communications-05-signature.png", ecran: "Communications", actions: [{ role: "button", nom: "Signature" }] },
  { fichier: "parametres-ariana-relances.png", ecran: "Paramètres de l'entreprise", actions: [{ defiler: "Relances renouvellement automatiques" }] },
  { fichier: "agences-01-liste.png", ecran: "Agences" },
  { fichier: "ebilling-01-ecran.png", ecran: "E-paiement" },
];

async function executer(page, a) {
  if (a.clic) await page.getByText(a.clic, { exact: true }).first().click();
  if (a.dblclic) await page.getByText(a.dblclic, { exact: true }).first().dblclick();
  if (a.role) await page.getByRole(a.role, { name: a.nom, exact: true }).first().click();
  if (a.saisir) await page.getByLabel(a.saisir).first().fill(a.texte);
  if (a.touche) await page.keyboard.press(a.touche);
  if (a.defiler) await page.getByText(a.defiler).first().scrollIntoViewIfNeeded();
  if (a.premierMessage) {
    const m = page.locator("[data-id]").first();
    if (a.double) await m.dblclick(); else await m.click();
  }
  await page.waitForTimeout(a.attendre ?? 1200);
}

(async () => {
  const { GUIDE_EMAIL, GUIDE_MDP } = process.env;
  if (!GUIDE_EMAIL || !GUIDE_MDP) { console.error("Définir GUIDE_EMAIL et GUIDE_MDP."); process.exit(1); }
  const filtre = process.argv[2];
  const liste = CAPTURES.filter((c) => !filtre || c.fichier.startsWith(filtre));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" })).newPage();
  await page.goto(URL);
  await page.waitForTimeout(2000);
  await page.locator("input").first().fill(GUIDE_EMAIL);
  await page.locator("input[type=password]").fill(GUIDE_MDP);
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await page.waitForTimeout(5000);

  for (const c of liste) {
    try {
      await page.reload(); // repart d'un écran propre : aucune fenêtre ouverte ne bloque la suivante
      await page.waitForTimeout(3000);
      await page.getByText(c.ecran, { exact: true }).first().click();
      await page.waitForTimeout(2500);
      for (const a of c.actions ?? []) await executer(page, a);
      await page.screenshot({ path: path.join(SORTIE, c.fichier) });
      console.log("OK ", c.fichier);
    } catch (err) {
      console.log("ÉCHEC", c.fichier, "—", err.message.split("\n")[0]);
    }
  }
  await browser.close();
})();

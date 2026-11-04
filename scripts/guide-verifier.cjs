// Contrôle de fraîcheur du Guide d'utilisateur : npm run guide:verifier [-- --strict]
// - chapitre dont le code (`sources`) a changé après `majLe` → à mettre à jour ;
// - écran de la console sans chapitre ; capture référencée mais absente.
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { execFileSync } = require("child_process");
const ts = require("typescript");

const RACINE = path.resolve(__dirname, "..");
const GUIDE = path.join(RACINE, "src/features/guide");
const CAPTURES = path.join(RACINE, "backend/assets/guide");

// Chargement des fichiers .tsx du guide sans bundler : transpilation à la volée,
// `img()` remplacé par le nom de fichier pour vérifier l'existence des captures.
const chargerTs = (module, fichier) => {
  const js = ts.transpileModule(fs.readFileSync(fichier, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  module._compile(js, fichier);
};
Module._extensions[".tsx"] = chargerTs;
Module._extensions[".ts"] = chargerTs;
const resoudre = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...r) {
  if (req === "./guideImages") return path.join(__dirname, "guide-images-stub.cjs");
  if (req.startsWith("@/")) req = path.join(RACINE, "src", req.slice(2));
  return resoudre.call(this, req, parent, ...r);
};
fs.writeFileSync(path.join(__dirname, "guide-images-stub.cjs"), "exports.img = (f) => f;");

const git = (...args) => execFileSync("git", args, { cwd: RACINE, encoding: "utf8" }).trim();

const fichiers = fs.readdirSync(GUIDE).filter((f) => /^guideContent.*\.tsx$/.test(f));
const chapitres = [];
for (const f of fichiers) {
  const exp = require(path.join(GUIDE, f));
  for (const [nom, liste] of Object.entries(exp)) {
    if (Array.isArray(liste)) liste.forEach((c) => chapitres.push({ ...c, fichier: f, liste: nom }));
  }
}

const aJour = [];
const perimes = [];
const sansSource = [];
for (const c of chapitres) {
  if (!c.sources?.length || !c.majLe) { sansSource.push(c); continue; }
  const derniere = git("log", "-1", "--format=%cs", "--", ...c.sources);
  if (derniere && derniere > c.majLe) {
    const n = git("rev-list", "--count", `--since=${c.majLe}T23:59:59`, "HEAD", "--", ...c.sources);
    perimes.push({ c, derniere, n: Number(n) });
  } else aJour.push(c);
}

// Écrans de la console interne (SanteAdminConsole) sans chapitre.
const console_ = fs.readFileSync(path.join(RACINE, "src/features/sante/SanteAdminConsole.tsx"), "utf8");
const ecrans = [...console_.matchAll(/import\("@\/features\/([a-z0-9-]+)/g)].map((m) => m[1]);
const couverts = new Set(chapitres.flatMap((c) => c.sources ?? []).map((s) => s.replace(/^src\/features\//, "").split("/")[0]));
const sansChapitre = [...new Set(ecrans)].filter((e) => !couverts.has(e));

// Captures référencées mais absentes.
const presentes = new Set(fs.existsSync(CAPTURES) ? fs.readdirSync(CAPTURES) : []);
const manquantes = [];
for (const c of chapitres) {
  for (const s of c.sections ?? []) {
    for (const im of [s.image, ...(s.etapes ?? []).map((e) => e.image)]) {
      if (im && !presentes.has(im)) manquantes.push(`${c.titre} → ${im}`);
    }
  }
}

console.log(`\nGuide d'utilisateur — ${chapitres.length} chapitres, ${presentes.size} captures\n`);
console.log(`À jour : ${aJour.length}`);
console.log(`À mettre à jour : ${perimes.length}`);
perimes.sort((a, b) => b.n - a.n).forEach(({ c, derniere, n }) =>
  console.log(`  - ${c.titre} [${c.fichier}] : mis à jour le ${c.majLe}, code modifié depuis (${n} commit${n > 1 ? "s" : ""}, dernier le ${derniere})`));
console.log(`Écrans sans chapitre : ${sansChapitre.length}${sansChapitre.length ? " → " + sansChapitre.join(", ") : ""}`);
console.log(`Chapitres non reliés au code : ${sansSource.length}${sansSource.length ? " → " + sansSource.map((c) => c.titre).join(", ") : ""}`);
console.log(`Captures manquantes : ${manquantes.length}`);
manquantes.forEach((m) => console.log(`  - ${m}`));

fs.unlinkSync(path.join(__dirname, "guide-images-stub.cjs"));
if (process.argv.includes("--strict") && (perimes.length || sansChapitre.length || manquantes.length)) process.exit(1);

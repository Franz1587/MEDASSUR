// Correction des échéances existantes (toutes sociétés) : une échéance n'est
// jamais le jour anniversaire de la date d'effet (01/03/2026 → 28/02/2027),
// et un exercice ne démarre jamais avant le lendemain de l'échéance précédente.
// À blanc par défaut ; `--appliquer` écrit en base.
//   prod  : docker exec <conteneur> node scripts/corriger-echeances.js [--appliquer]
//   local : node scripts/corriger-echeances.js (via ts-node sur src/)
const { PrismaClient } = require("@prisma/client");

const regle = (() => {
  try { return require("../dist/src/contrats/echeance.util"); } catch { /* pas encore compilé */ }
  try { return require("./echeance.util"); } catch {
    require("ts-node/register/transpile-only");
    return require("../src/contrats/echeance.util");
  }
})();
const { parseDateFr, lendemain, normaliserEcheance, echeanceParDefaut, echeanceValide } = regle;
const APPLIQUER = process.argv.includes("--appliquer");

(async () => {
  const prisma = new PrismaClient();
  const societes = new Map((await prisma.societeAssurance.findMany({ select: { id: true, nom: true } })).map((s) => [s.id, s.nom]));
  const contrats = await prisma.contrat.findMany({
    select: {
      id: true, numeroPolice: true, societeId: true, dateDebut: true, dateFin: true, exerciceNumero: true,
      exercices: { select: { id: true, numero: true, dateDebut: true, dateFin: true } },
    },
  });

  const majExercices = [];
  const majContrats = [];
  const anomalies = [];
  const parSociete = new Map();
  const compter = (sid) => { const n = societes.get(sid) ?? "(sans société)"; parSociete.set(n, (parSociete.get(n) ?? 0) + 1); };

  for (const c of contrats) {
    const exs = [...c.exercices].sort((a, b) => a.numero - b.numero || (parseDateFr(a.dateDebut) ?? 0) - (parseDateFr(b.dateDebut) ?? 0));
    let finPrecedente = null;
    let touche = false;
    for (const ex of exs) {
      let debut = ex.dateDebut;
      const dDebut = parseDateFr(debut);
      if (finPrecedente && dDebut && dDebut <= parseDateFr(finPrecedente)) debut = lendemain(finPrecedente);
      const fin = normaliserEcheance(debut, ex.dateFin);
      if (!echeanceValide(debut, fin)) {
        anomalies.push(`${societes.get(c.societeId) ?? "?"} | police ${c.numeroPolice ?? "?"} | exercice n°${ex.numero} ${ex.dateDebut} → ${ex.dateFin} (période vide ou inversée, laissée telle quelle)`);
        finPrecedente = ex.dateFin;
        continue;
      }
      if (debut !== ex.dateDebut || fin !== ex.dateFin) {
        majExercices.push({ id: ex.id, avant: `${ex.dateDebut} → ${ex.dateFin}`, apres: `${debut} → ${fin}`, police: c.numeroPolice, numero: ex.numero, debut, fin });
        ex.dateDebut = debut; ex.dateFin = fin; touche = true;
      }
      finPrecedente = fin;
    }

    // Le contrat reprend la période de son exercice courant (scindé possible : du premier début à la dernière fin).
    const courants = exs.filter((e) => e.numero === c.exerciceNumero);
    let debut = c.dateDebut;
    let fin = c.dateFin;
    if (courants.length) {
      debut = courants[0].dateDebut;
      fin = courants[courants.length - 1].dateFin;
    } else {
      fin = normaliserEcheance(debut, fin);
    }
    if (debut !== c.dateDebut || fin !== c.dateFin) {
      majContrats.push({ id: c.id, police: c.numeroPolice, avant: `${c.dateDebut} → ${c.dateFin}`, apres: `${debut} → ${fin}`, debut, fin });
      touche = true;
    }
    if (touche) compter(c.societeId);
  }

  // Renouvellements en attente : démarrent le lendemain de l'échéance (corrigée) du contrat.
  const finContrat = new Map(contrats.map((c) => [c.id, (majContrats.find((m) => m.id === c.id) ?? { fin: c.dateFin }).fin]));
  const renouvellements = await prisma.avenant.findMany({
    where: { type: "Renouvellement", statut: { notIn: ["Appliqué", "Perdu"] } },
    select: { id: true, contratId: true, dateEffet: true, dateFin: true },
  });
  const majAvenants = [];
  for (const a of renouvellements) {
    const finC = finContrat.get(a.contratId);
    if (!finC) continue;
    const effet = lendemain(finC);
    const fin = echeanceParDefaut(effet);
    if (effet !== a.dateEffet || fin !== a.dateFin) majAvenants.push({ id: a.id, avant: `${a.dateEffet} → ${a.dateFin}`, apres: `${effet} → ${fin}`, effet, fin });
  }

  console.log(`Contrats analysés : ${contrats.length}`);
  console.log(`Exercices à corriger : ${majExercices.length}`);
  console.log(`Contrats à corriger : ${majContrats.length}`);
  console.log(`Renouvellements en attente à corriger : ${majAvenants.length}`);
  console.log(`Anomalies non corrigées : ${anomalies.length}`);
  console.log("Contrats touchés par société :", JSON.stringify(Object.fromEntries(parSociete)));
  console.log("Exemples exercices :", majExercices.slice(0, 8).map((m) => `police ${m.police} n°${m.numero} ${m.avant} ⇒ ${m.apres}`));
  console.log("Exemples contrats :", majContrats.slice(0, 8).map((m) => `police ${m.police} ${m.avant} ⇒ ${m.apres}`));
  console.log("Exemples renouvellements :", majAvenants.slice(0, 5).map((m) => `${m.avant} ⇒ ${m.apres}`));
  if (anomalies.length) console.log("Anomalies :", anomalies.slice(0, 15));

  if (APPLIQUER) {
    const ops = [
      ...majExercices.map((m) => prisma.exercice.update({ where: { id: m.id }, data: { dateDebut: m.debut, dateFin: m.fin } })),
      ...majContrats.map((m) => prisma.contrat.update({ where: { id: m.id }, data: { dateDebut: m.debut, dateFin: m.fin } })),
      ...majAvenants.map((m) => prisma.avenant.update({ where: { id: m.id }, data: { dateEffet: m.effet, dateFin: m.fin } })),
    ];
    for (let i = 0; i < ops.length; i += 500) await prisma.$transaction(ops.slice(i, i + 500));
    console.log(`APPLIQUÉ : ${ops.length} mises à jour.`);
  } else {
    console.log("À BLANC — rien n'a été modifié. Relancer avec --appliquer.");
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

// Auto-test : node dist/src/import/nettoyage-doublons.check.js
import * as assert from "assert";
import { NettoyageDoublonsService } from "./nettoyage-doublons.service";

let n = 0;
const ligne = (minute: number, seconde: number, o: { acte?: string; bordereau?: boolean } = {}) => ({
  id: `L${n++}`, assureId: "A", date: "27/02/2026", montant: 15000, createdAt: new Date(2026, 9, 31, 23, minute, seconde), statut: "Déclaré", motifAnnulation: null,
  bordereauId: o.bordereau ? "B" : null, remboursementId: null, factureId: "F", prestataireId: "P", referenceFacture: "R",
  acteMedicalId: o.acte ?? "GEN", acteGenerique: !o.acte, dependante: false,
});
const passe = (g: Parameters<typeof NettoyageDoublonsService.trier>[0]) => NettoyageDoublonsService.trier(g);

// Même fichier importé 9 fois, une ligne : on en garde 1.
const neuf = Array.from({ length: 9 }, (_, i) => ligne(29 + i, 0));
assert.strictEqual(passe(neuf).gardees.length, 1);
// Fichier qui contient 2 lignes identiques, importé 3 fois : on garde les 2 d'un même import.
const repetees = [0, 1, 2].flatMap((i) => [ligne(30 + i, 1), ligne(30 + i, 2)]);
const r1 = passe(repetees);
assert.strictEqual(r1.gardees.length, 2);
assert.strictEqual(passe(r1.gardees).copies.length, 0, "second passage stable (génériques)");
// Actes corrigés (NFS, CRP) + anciennes copies génériques : un exemplaire par acte réel.
const corrigees = [ligne(30, 0, { acte: "NFS" }), ligne(30, 0, { acte: "CRP" }), ligne(31, 0, { acte: "NFS" }), ...neuf.slice(0, 4)];
const r2 = passe(corrigees);
assert.deepStrictEqual(r2.gardees.map((l) => l.acteMedicalId).sort(), ["CRP", "NFS"]);
assert.strictEqual(passe(r2.gardees).copies.length, 0, "second passage stable (actes réels)");
// La copie déjà réglée est celle qu'on garde.
const reglee = [ligne(29, 0, { acte: "NFS" }), ligne(35, 0, { acte: "NFS", bordereau: true })];
assert.strictEqual(passe(reglee).gardees[0].bordereauId, "B");
console.log("nettoyage-doublons.check : OK");

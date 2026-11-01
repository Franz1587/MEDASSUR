// Auto-test : node dist/src/import/beneficiaire.check.js
import * as assert from "assert";
import { beneficiaireReel, scoreNom, type MembreFamille } from "./beneficiaire.util";

const titulaire = { id: "T", nom: "ETOUMBI", prenom: "Belinda Gladys", familleId: null, contratId: "C" };
const enfant: MembreFamille = { id: "E", nom: "ETOUMBI", prenom: "Kevin", familleId: "T", contratId: "C" };
const conjoint: MembreFamille = { id: "J", nom: "MENGUE", prenom: "Barbara", familleId: "T", contratId: "C" };
const familles = new Map([["T", [titulaire, enfant, conjoint]]]);

assert.strictEqual(scoreNom("Barbara MENGUE Epse OREZANS", conjoint), 1);
assert.strictEqual(beneficiaireReel(titulaire, "ETOUMBI Kevin", familles).id, "E", "ayant droit nommé");
assert.strictEqual(beneficiaireReel(titulaire, "Barbara MENGUE Epse OREZANS", familles).id, "J", "conjointe, nom d'épouse");
assert.strictEqual(beneficiaireReel(titulaire, "ETOUMBI Belinda Gladys", familles).id, "T", "titulaire lui-même");
assert.strictEqual(beneficiaireReel(titulaire, "ETOUMBI", familles).id, "T", "nom seul ambigu : on garde le titulaire");
assert.strictEqual(beneficiaireReel(titulaire, "", familles).id, "T", "colonne vide");
assert.strictEqual(beneficiaireReel(titulaire, "NDONG Paul", familles).id, "T", "inconnu de la famille");
console.log("beneficiaire.check : OK");

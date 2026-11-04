// Vérification de la règle d'échéance : npx ts-node scripts/verifier-echeance.ts
import { strict as assert } from "assert";
import { echeanceParDefaut, echeanceValide, lendemain, normaliserEcheance } from "../src/contrats/echeance.util";

assert.equal(echeanceParDefaut("01/03/2026"), "28/02/2027");
assert.equal(echeanceParDefaut("01/03/2027"), "29/02/2028"); // 2028 bissextile
assert.equal(echeanceParDefaut("01/01/2026"), "31/12/2026");
assert.equal(echeanceParDefaut("29/02/2028"), "28/02/2029");
assert.equal(echeanceParDefaut("15/07/2026"), "14/07/2027");

assert.equal(normaliserEcheance("01/03/2026", "01/03/2027"), "28/02/2027");
assert.equal(normaliserEcheance("01/01/2026", "01/01/2027"), "31/12/2026");
assert.equal(normaliserEcheance("01/03/2026", "28/02/2027"), "28/02/2027");
assert.equal(normaliserEcheance("01/01/2026", "30/06/2026"), "30/06/2026"); // période courte inchangée

assert.equal(lendemain("28/02/2027"), "01/03/2027");
assert.equal(lendemain("31/12/2026"), "01/01/2027");

assert.equal(echeanceValide("01/03/2026", "28/02/2027"), true);
assert.equal(echeanceValide("01/03/2026", "01/03/2026"), false);
assert.equal(echeanceValide("01/03/2026", "15/02/2026"), false);

console.log("Règle d'échéance : OK");

// Auto-test : `npx ts-node src/factures/reference-facture.check.ts`.
import assert from "node:assert";
import { estReferenceTeleTransmise, referenceLisible } from "./reference-facture.util";

assert.equal(referenceLisible("ISFCT-f1f3a35f-77f3-447a-ae8b-17eef3d034dd-20260317121053742"), "Télétrans. 17/03/2026 12h10");
assert.equal(referenceLisible("MS-PRESTA-349bbdea-fb66-433d-bc8b-7c64a9382d0e-20260306133600455"), "Télétrans. 06/03/2026 13h36");
assert.equal(referenceLisible("CHUL-000010/2026"), "CHUL-000010/2026");
assert.equal(referenceLisible("FAC-2026-001"), "FAC-2026-001");
assert.ok(estReferenceTeleTransmise("ISFCT-473ae046-0228-48c7-92dc-0f90d185702c-20260318085233074"));
assert.ok(!estReferenceTeleTransmise("CHUL-000010/2026"));
console.log("referenceLisible : ok");

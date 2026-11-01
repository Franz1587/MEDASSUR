// Auto-test du rapprochement libellé lu → acte du catalogue : `npx ts-node src/prescriptions/meilleur-acte.check.ts`.
import assert from "node:assert";
import { meilleurActe } from "./prescriptions.service";

const catalogue = [{ libelle: "ALVITYL COMPRIMES B/40" }, { libelle: "Glycémie" }, { libelle: "Numération formule sanguine" }, { libelle: "PARACETAMOL 1G COMPRIMES" }];
assert.equal(meilleurActe("Paracétamol 1 g comprimés", catalogue)?.libelle, "PARACETAMOL 1G COMPRIMES");
assert.equal(meilleurActe("Amoxicilline 500 mg gélules", catalogue), null);
assert.equal(meilleurActe("Glycémie à jeun", catalogue)?.libelle, "Glycémie");
assert.equal(meilleurActe("NFS - numération formule sanguine", catalogue)?.libelle, "Numération formule sanguine");
console.log("meilleurActe : ok");

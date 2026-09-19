const XLSX = require("xlsx");
const path = require("path");

const DIR = "D:\\PROJET MEDASSUR\\MEDASSUR\\Modèle import pour La Ruche\\FACTURES 2024";
const files = ["jav-mar 2024-1.xlsx", "avril-juin 2024-1.xls", "juil-sept 2024-1.xls", "oct-dec 2024-1.xls"];

for (const f of files) {
  console.log("\n\n========================================");
  console.log("FICHIER:", f);
  console.log("========================================");
  const wb = XLSX.readFile(path.join(DIR, f));
  console.log("Feuilles:", wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    console.log(`\n--- Feuille "${sheetName}" : ${rows.length} lignes ---`);
    for (let i = 0; i < Math.min(8, rows.length); i++) {
      console.log(i, JSON.stringify(rows[i]));
    }
  }
}

import * as path from "path";

// Racine des dossiers uploads/assets (2026-08, correction d'un bug de fond) —
// process.cwd() plutôt que __dirname. `nest start --watch` compile et
// exécute depuis dist/src/..., où __dirname ne pointe plus vers backend/ :
// l'ancien calcul (path.join(__dirname, "..", "..", "uploads")) atterrissait
// donc dans dist/uploads (jamais backend/uploads, où vivent réellement les
// fichiers déjà présents) — et dist/ est entièrement effacé à chaque
// recompilation (nest-cli.json "deleteOutDir": true), d'où la disparition
// répétée des logos/photos/documents uploadés ("ça se réinitialise à chaque
// fois" alors que la référence, elle, reste bien en base). process.cwd()
// reste backend/ quel que soit le mode (ts-node en dev, node dist/main.js
// en prod), tant que le process est lancé depuis ce dossier — toujours le
// cas ici (`cd backend && npm run dev` / `npm start`).
export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const ASSETS_ROOT = path.join(process.cwd(), "assets");

// Résolution des captures du guide par nom de fichier (2026-09) — évite une
// ligne d'import statique par image (le guide en compte plusieurs dizaines,
// voir demande utilisateur : "il faut aussi aller plus en détails... des
// capture secondaire, terciaire..."). `import.meta.glob` charge une fois
// tout le dossier au build ; `img("xxx.png")` référence ensuite une capture
// par son simple nom de fichier depuis guideContent.tsx.
const modules = import.meta.glob<{ default: string }>("/src/assets/guide/*.png", { eager: true });

const map: Record<string, string> = {};
for (const path in modules) {
  const filename = path.split("/").pop();
  if (filename) map[filename] = modules[path].default;
}

export function img(filename: string): string {
  const url = map[filename];
  if (!url && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`Guide d'utilisateur : capture manquante "${filename}"`);
  }
  return url ?? "";
}

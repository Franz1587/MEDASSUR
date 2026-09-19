// Pont simple entre documents.service.ts (module TS pur, sans accès à React)
// et le composant React <PdfViewerHost /> monté une seule fois à la racine
// de l'app (voir main.tsx) — évite d'avoir à faire remonter un contexte
// React à travers toute l'arborescence pour un simple appel impératif
// "affiche ce PDF". Si le host n'est pas encore monté (improbable, mais par
// prudence), on retombe sur un téléchargement forcé plutôt que de perdre le
// document.
export interface PdfAAfficher {
  blob: Blob;
  nomFichier: string;
}

type Afficheur = (doc: PdfAAfficher) => void;

let afficheur: Afficheur | null = null;

export function enregistrerAfficheurPdf(fn: Afficheur | null) {
  afficheur = fn;
}

export function afficherPdf(doc: PdfAAfficher) {
  if (afficheur) {
    afficheur(doc);
    return;
  }
  const url = URL.createObjectURL(doc.blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = doc.nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Alphabet sans caractères ambigus (0/O, 1/l/I) — un mot de passe temporaire
// doit rester lisible/retapable depuis un SMS. Même convention que
// ComptesMobileService.genererMotDePasseTemporaire (2026-08), extraite ici
// pour être réutilisable (2026-09, voir PrestatairesService.creerComptePortail).
const ALPHABET_MOT_DE_PASSE = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function genererMotDePasseTemporaire(longueur = 9): string {
  let mdp = "";
  for (let i = 0; i < longueur; i++) {
    mdp += ALPHABET_MOT_DE_PASSE[Math.floor(Math.random() * ALPHABET_MOT_DE_PASSE.length)];
  }
  return mdp;
}

// Identifiant lisible dérivé d'un nom (2026-09) — voir demande utilisateur :
// "sers-toi des données du prestataire (nom) pour créer les comptes".
// Minuscules, sans accents, espaces/ponctuation réduits à un tiret unique.
export function slugifier(texte: string): string {
  const sansAccents = texte
    .normalize("NFD")
    .split("")
    .filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f)
    .join("");
  return (
    sansAccents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "compte"
  );
}

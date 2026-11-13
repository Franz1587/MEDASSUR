// Alphabet sans caractères ambigus (0/O, 1/l/I) — un mot de passe temporaire
// doit rester lisible/retapable depuis un SMS. Même convention que
// ComptesMobileService.genererMotDePasseTemporaire (2026-08), extraite ici
// pour être réutilisable (2026-09, voir PrestatairesService.creerComptePortail).
import { randomInt } from "crypto";

const MINUSCULES = "abcdefghjkmnpqrstuvwxyz";
const MAJUSCULES = "ABCDEFGHJKMNPQRSTUVWXYZ";
const CHIFFRES = "23456789";
const SYMBOLES = "!@#$%*+?";
const ALPHABET_MOT_DE_PASSE = MINUSCULES + MAJUSCULES + CHIFFRES + SYMBOLES;

const tirer = (alphabet: string) => alphabet[randomInt(alphabet.length)];

// Mot de passe temporaire cryptographiquement aléatoire (crypto.randomInt) —
// au moins 12 caractères, avec au moins une minuscule, une majuscule, un
// chiffre et un symbole.
export function genererMotDePasseTemporaire(longueur = 12): string {
  const n = Math.max(12, longueur);
  const caracteres = [tirer(MINUSCULES), tirer(MAJUSCULES), tirer(CHIFFRES), tirer(SYMBOLES)];
  while (caracteres.length < n) caracteres.push(tirer(ALPHABET_MOT_DE_PASSE));
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
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

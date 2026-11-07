export const MESSAGE_POLITIQUE_MOT_DE_PASSE =
  "Le mot de passe doit contenir au moins 10 caractères, dont au moins 3 types parmi : minuscules, majuscules, chiffres, symboles.";

// Même règle que backend/src/auth/password-policy.ts.
export function motDePasseConforme(mdp: string): boolean {
  if (mdp.length < 10 || mdp.length > 128) return false;
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(mdp)).length >= 3;
}

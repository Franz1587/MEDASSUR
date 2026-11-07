import { registerDecorator, type ValidationOptions } from "class-validator";

export const MESSAGE_POLITIQUE_MOT_DE_PASSE =
  "Le mot de passe doit contenir au moins 10 caractères, dont au moins 3 types parmi : minuscules, majuscules, chiffres, symboles.";

/** Politique de mot de passe : ≥ 10 caractères et ≥ 3 classes parmi minuscule/majuscule/chiffre/symbole. */
export function estMotDePasseConforme(mdp: unknown): boolean {
  if (typeof mdp !== "string" || mdp.length < 10 || mdp.length > 128) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(mdp)).length;
  return classes >= 3;
}

/** Décorateur class-validator appliquant la politique ci-dessus (changement / réinitialisation). */
export function MotDePasseConforme(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "motDePasseConforme",
      target: object.constructor,
      propertyName,
      options: { message: MESSAGE_POLITIQUE_MOT_DE_PASSE, ...options },
      validator: { validate: (value: unknown) => estMotDePasseConforme(value) },
    });
  };
}

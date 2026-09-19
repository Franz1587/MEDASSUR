import * as React from "react";

import { cn } from "./utils";

// Dictionnaire intuitif garanti (2026-09) — voir demande utilisateur :
// "mettre un dictionnaire intuitif pour toute saisie dans l'application".
// spellCheck/autoCorrect/autoCapitalize sont normalement activés par
// défaut par le navigateur, mais les rendre explicites évite qu'un
// attribut oublié quelque part désactive la correction/suggestion —
// `{...props}` reste APRÈS ces valeurs par défaut pour qu'un appelant
// puisse volontairement les désactiver au cas par cas (ex. un champ
// "numéro de police").
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      spellCheck
      autoCorrect="on"
      autoCapitalize="sentences"
      className={cn(
        "resize-none border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

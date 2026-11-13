interface ParsedMail { headerLines?: readonly { key: string; line: string }[] }

export interface ResultatAuthEmail {
  authentifie: boolean;
  motif: string;
}

function domaineDe(adresse: string): string {
  return adresse.slice(adresse.lastIndexOf("@") + 1).trim().toLowerCase();
}

// Alignement "relaxed" (DMARC) : même domaine ou sous-domaine de l'autre.
function aligne(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

// Authentification de l'expéditeur d'après l'en-tête Authentication-Results
// ajouté par NOTRE serveur de réception. Seul l'en-tête le plus haut (le plus
// récent, ajouté par le dernier relais) est lu : ceux plus bas peuvent avoir
// été forgés par l'expéditeur. Si EMAIL_AUTHSERV_ID est défini, l'authserv-id
// doit correspondre (recommandé en production). En-tête absent = non authentifié.
export function verifierAuthentificationEmail(mail: ParsedMail, fromAddress: string): ResultatAuthEmail {
  const domaineFrom = domaineDe(fromAddress);
  if (!domaineFrom || !fromAddress.includes("@")) return { authentifie: false, motif: "adresse expéditeur invalide" };

  const ligne = (mail.headerLines ?? []).find((h) => h.key.toLowerCase() === "authentication-results");
  if (!ligne) return { authentifie: false, motif: "en-tête Authentication-Results absent" };

  const valeur = ligne.line.slice(ligne.line.indexOf(":") + 1).replace(/\s+/g, " ").trim().toLowerCase();
  const [authservBrut, ...methodes] = valeur.split(";").map((s) => s.trim());
  const authservId = authservBrut.split(" ")[0];
  const attendu = process.env.EMAIL_AUTHSERV_ID?.trim().toLowerCase();
  if (attendu && authservId !== attendu) return { authentifie: false, motif: "authserv-id inattendu" };

  for (const m of methodes) {
    const prop = (cle: string) => new RegExp(`(?:^|[\\s;])${cle.replace(".", "\\.")}=([^\\s;]+)`).exec(m)?.[1]?.replace(/^<|>$/g, "");
    if (/^dkim=pass\b/.test(m) && aligne(prop("header.d") ?? "", domaineFrom)) return { authentifie: true, motif: "dkim=pass aligné" };
    if (/^spf=pass\b/.test(m)) {
      const mailfrom = prop("smtp.mailfrom") ?? "";
      if (aligne(mailfrom.includes("@") ? domaineDe(mailfrom) : mailfrom, domaineFrom)) return { authentifie: true, motif: "spf=pass aligné" };
    }
    if (/^dmarc=pass\b/.test(m) && aligne(prop("header.from") ?? domaineFrom, domaineFrom)) return { authentifie: true, motif: "dmarc=pass" };
  }
  return { authentifie: false, motif: "aucun dkim/spf/dmarc=pass aligné avec le domaine From" };
}

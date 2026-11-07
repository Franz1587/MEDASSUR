import { HttpException, HttpStatus } from "@nestjs/common";

const FENETRE_MS = 15 * 60 * 1000;
const MAX_ECHECS_PAR_COMPTE = 8;
// Plafond global par IP (toutes identités confondues) contre le "password spraying".
const MAX_ECHECS_PAR_IP = 40;
const MAX_ENTREES = 20_000;

interface Compteur {
  echecs: number;
  debut: number;
}

export class TropDeTentativesException extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super("Trop de tentatives de connexion — réessayez plus tard.", HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Limiteur de tentatives de connexion en mémoire (par IP + identifiant, et par IP seule). */
export class LoginThrottle {
  private readonly parCompte = new Map<string, Compteur>();
  private readonly parIp = new Map<string, Compteur>();

  private static cle(ip: string, identifiant: string) {
    return `${ip}|${identifiant.trim().toLowerCase()}`;
  }

  private static actif(c: Compteur | undefined, maintenant: number): c is Compteur {
    return !!c && maintenant - c.debut < FENETRE_MS;
  }

  private purger(table: Map<string, Compteur>, maintenant: number) {
    if (table.size < MAX_ENTREES) return;
    for (const [k, c] of table) if (maintenant - c.debut >= FENETRE_MS) table.delete(k);
    if (table.size >= MAX_ENTREES) table.clear();
  }

  /** Lève TropDeTentativesException (429) si la limite est atteinte. */
  verifier(ip: string, identifiant: string) {
    const maintenant = Date.now();
    const verifs: [Compteur | undefined, number][] = [
      [this.parCompte.get(LoginThrottle.cle(ip, identifiant)), MAX_ECHECS_PAR_COMPTE],
      [this.parIp.get(ip), MAX_ECHECS_PAR_IP],
    ];
    for (const [c, max] of verifs) {
      if (LoginThrottle.actif(c, maintenant) && c.echecs >= max) {
        throw new TropDeTentativesException(Math.max(1, Math.ceil((c.debut + FENETRE_MS - maintenant) / 1000)));
      }
    }
  }

  enregistrerEchec(ip: string, identifiant: string) {
    const maintenant = Date.now();
    const incrementer = (table: Map<string, Compteur>, cle: string) => {
      this.purger(table, maintenant);
      const existant = table.get(cle);
      if (LoginThrottle.actif(existant, maintenant)) existant.echecs += 1;
      else table.set(cle, { echecs: 1, debut: maintenant });
    };
    incrementer(this.parCompte, LoginThrottle.cle(ip, identifiant));
    incrementer(this.parIp, ip);
  }

  enregistrerSucces(ip: string, identifiant: string) {
    this.parCompte.delete(LoginThrottle.cle(ip, identifiant));
  }
}

export const loginThrottle = new LoginThrottle();

/** IP du client ; X-Forwarded-For (premier élément) uniquement si TRUST_PROXY est défini. */
export function ipClient(req: { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  if (process.env.TRUST_PROXY) {
    const xff = req.headers?.["x-forwarded-for"];
    const brut = Array.isArray(xff) ? xff[0] : xff;
    const premier = brut?.split(",")[0]?.trim();
    if (premier) return premier;
  }
  return req.socket?.remoteAddress ?? req.ip ?? "inconnue";
}

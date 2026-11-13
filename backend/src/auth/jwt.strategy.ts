import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { getJwtSecret } from "./jwt-secret";
import { verifierSocieteNonSuspendue } from "./societe-active";

export interface JwtPayload {
  sub: string;
  email: string;
  nom: string;
  roleId: string;
  clientId?: string | null;
  assureSanteId?: string | null;
  prestataireId?: string | null;
  medecinId?: string | null;
  societeId?: string | null;
  /** Mode assistance : id du super_admin à l'origine du token. */
  act?: string;
}

interface UtilisateurCharge {
  id: string;
  email: string;
  nom: string;
  roleId: string;
  clientId: string | null;
  assureSanteId: string | null;
  prestataireId: string | null;
  medecinId: string | null;
  societeId: string | null;
  modules: string[];
  doitChangerMotDePasse: boolean;
  modulesSociete: string[] | null;
}

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTREES = 2000;
const cacheUtilisateurs = new Map<string, { expire: number; valeur: UtilisateurCharge }>();

/** À appeler après toute écriture qui doit s'appliquer immédiatement (ex. mot de passe changé). */
export function invaliderCacheUtilisateur(userId: string) {
  cacheUtilisateurs.delete(userId);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  // Relecture en base (cache 30 s par utilisateur) : rôle, société, modules et
  // obligation de changer le mot de passe viennent TOUJOURS de la base, jamais
  // du contenu (périmé) du token. Un compte supprimé ou une société suspendue
  // coupe donc aussi les sessions déjà ouvertes.
  private async charger(userId: string): Promise<UtilisateurCharge> {
    const maintenant = Date.now();
    const enCache = cacheUtilisateurs.get(userId);
    if (enCache && enCache.expire > maintenant) return enCache.valeur;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Compte introuvable");
    const societe = await verifierSocieteNonSuspendue(this.prisma, user.societeId);

    const valeur: UtilisateurCharge = {
      id: user.id, email: user.email, nom: user.nom, roleId: user.roleId,
      clientId: user.clientId, assureSanteId: user.assureSanteId, prestataireId: user.prestataireId,
      medecinId: user.medecinId, societeId: user.societeId,
      modules: user.modules ?? [], doitChangerMotDePasse: user.doitChangerMotDePasse,
      modulesSociete: societe?.modules ?? null,
    };
    if (cacheUtilisateurs.size >= CACHE_MAX_ENTREES) {
      for (const [cle, entree] of cacheUtilisateurs) if (entree.expire <= maintenant) cacheUtilisateurs.delete(cle);
      if (cacheUtilisateurs.size >= CACHE_MAX_ENTREES) cacheUtilisateurs.clear();
    }
    cacheUtilisateurs.set(userId, { expire: maintenant + CACHE_TTL_MS, valeur });
    return valeur;
  }

  async validate(payload: JwtPayload) {
    const user = await this.charger(payload.sub);

    let act: string | null = null;
    if (payload.act) {
      const acteur = await this.charger(payload.act);
      if (acteur.roleId !== "super_admin" || acteur.societeId) {
        throw new UnauthorizedException("Session d'assistance invalide");
      }
      act = acteur.id;
    }

    return {
      userId: user.id, email: user.email, nom: user.nom, roleId: user.roleId,
      clientId: user.clientId, assureSanteId: user.assureSanteId,
      prestataireId: user.prestataireId, medecinId: user.medecinId,
      societeId: user.societeId,
      // Assistance : le super_admin voit l'abonnement complet de la société, sans
      // être soumis à l'obligation de changer le mot de passe de l'administrateur.
      modules: act && user.modulesSociete ? user.modulesSociete : user.modules,
      doitChangerMotDePasse: act ? false : user.doitChangerMotDePasse,
      act,
    };
  }
}

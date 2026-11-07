import { SetMetadata } from "@nestjs/common";

export const ALLOW_TEMPORARY_PASSWORD_KEY = "allowTemporaryPassword";

/**
 * Route accessible même quand le compte doit encore changer son mot de passe
 * temporaire (changement de mot de passe, GET /auth/me, déconnexion).
 * Toute autre route est refusée tant que doitChangerMotDePasse est vrai.
 */
export const AllowTemporaryPassword = () => SetMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, true);

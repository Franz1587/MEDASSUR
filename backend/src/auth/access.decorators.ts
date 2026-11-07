import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const ALLOW_EXTERNAL_KEY = "allowExternal";
export const REQUIRE_MODULE_KEY = "requireModule";

/** Route sans authentification (login, callbacks signés, vérification publique…). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Route authentifiée utilisable par les comptes externes (assuré, prestataire,
 * client, médecin) sans @Roles explicite. Par défaut, une route sans @Roles
 * est réservée aux rôles internes.
 */
export const AllowExternal = () => SetMetadata(ALLOW_EXTERNAL_KEY, true);

/** Exige qu'au moins un des modules soit présent dans User.modules (lu en base). */
export const RequireModule = (...modules: string[]) => SetMetadata(REQUIRE_MODULE_KEY, modules);

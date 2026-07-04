import { SetMetadata } from "@nestjs/common";
import type { RoleId } from "./role.enum";

export const ROLES_KEY = "roles";
export const Roles = (...roles: RoleId[]) => SetMetadata(ROLES_KEY, roles);

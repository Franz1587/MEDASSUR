import type { mockUsers, mockRoles } from "@/data/mock/admin.mock";

export type UserAccount = (typeof mockUsers)[number];
export type RoleSummary = (typeof mockRoles)[number];

import { mockUsers, mockRoles } from "@/data/mock/admin.mock";
import type { UserAccount, RoleSummary } from "@/types/admin";

export async function getUsers(): Promise<UserAccount[]> {
  return mockUsers;
}

export async function getRoleSummaries(): Promise<RoleSummary[]> {
  return mockRoles;
}

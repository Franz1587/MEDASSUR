import { http } from "@/lib/http";
import type { Client } from "@/types/clients";

export async function getClients(): Promise<Client[]> {
  return http.get<Client[]>("/clients");
}

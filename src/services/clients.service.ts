import { mockClients } from "@/data/mock/clients.mock";
import type { Client } from "@/types/clients";

export async function getClients(): Promise<Client[]> {
  return mockClients;
}

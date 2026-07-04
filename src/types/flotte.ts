import type { mockFlottes } from "@/data/mock/flotte.mock";

export type Flotte = (typeof mockFlottes)[number];
export type Vehicule = Flotte["vehicules"][number];

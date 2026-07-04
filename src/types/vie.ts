import type { mockContratsVie } from "@/data/mock/vie.mock";

export type ContratVie = (typeof mockContratsVie)[number];
export type Beneficiaire = ContratVie["beneficiaires"][number];

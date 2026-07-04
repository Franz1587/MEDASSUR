import type { productionMensuelle, portefeuilleBranche, sinistraliteData } from "@/data/mock/dashboard.mock";

export type ProductionMensuelle = (typeof productionMensuelle)[number];
export type PortefeuilleBranche = (typeof portefeuilleBranche)[number];
export type SinistraliteData = (typeof sinistraliteData)[number];

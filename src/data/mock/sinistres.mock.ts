export const mockSinistres = [
  { id: "SIN-2024-0451", client: "SABC SA", branche: "Flotte Auto", date: "15/10/2024", description: "Collision véhicule M-YA 234 CE", montant: 4_500_000, statut: "Expert. en cours", priorite: "Haute" },
  { id: "SIN-2024-0452", client: "Fatou Sow", branche: "Automobile", date: "18/10/2024", description: "Vol partiel — pièces moteur", montant: 1_200_000, statut: "Déclaré", priorite: "Normal" },
  { id: "SIN-2024-0450", client: "Groupe CFAO", branche: "IARD", date: "12/10/2024", description: "Incendie entrepôt Cocody II", montant: 125_000_000, statut: "Expertise", priorite: "Urgent" },
  { id: "SIN-2024-0449", client: "MTN Cameroun", branche: "Santé", date: "10/10/2024", description: "Hospitalisation — P. Essomba", montant: 3_800_000, statut: "Remboursé", priorite: "Normal" },
  { id: "SIN-2024-0448", client: "SOGEA-SATOM CI", branche: "RC Pro", date: "08/10/2024", description: "Accident chantier Bassam V", montant: 8_600_000, statut: "Recours", priorite: "Haute" },
  { id: "SIN-2024-0447", client: "BGFI Bank", branche: "IARD", date: "05/10/2024", description: "Dégâts des eaux — bureau DG", montant: 2_100_000, statut: "Clôturé", priorite: "Normal" },
];

export const kanbanColumns: Record<string, string[]> = {
  "Déclaré": ["SIN-2024-0452", "SIN-2024-0453", "SIN-2024-0454"],
  "Expert. en cours": ["SIN-2024-0451", "SIN-2024-0455"],
  "Expertise": ["SIN-2024-0450"],
  "Recours": ["SIN-2024-0448"],
  "Remboursé": ["SIN-2024-0449", "SIN-2024-0456"],
  "Clôturé": ["SIN-2024-0447"],
};

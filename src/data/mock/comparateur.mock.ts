export const mockOffres = [
  {
    compagnie: "ACTIVA Assurances", prime: 2_850_000,
    garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol complet", "Incendie"],
    franchise: "150 000 XAF", plafond: "50M XAF", score: 94, recommande: true,
  },
  {
    compagnie: "AXA Côte d'Ivoire", prime: 2_620_000,
    garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol partiel", "Bris de glace"],
    franchise: "200 000 XAF", plafond: "30M XAF", score: 78, recommande: false,
  },
  {
    compagnie: "Allianz Sénégal", prime: 3_100_000,
    garanties: ["RC Civile illimitée", "Dommages tous accidents", "Vol complet", "Incendie", "Assistance 24h/7j", "Véhicule de remplacement"],
    franchise: "100 000 XAF", plafond: "75M XAF", score: 88, recommande: false,
  },
];

export const aiComparatifSynthese =
  "Sur la base des garanties, franchises et tarifs analysés, ACTIVA Assurances offre le meilleur rapport garanties/prix (Score: 94/100). L'offre Allianz est plus complète (+2 garanties) mais 8.8% plus chère. Attention: L'offre AXA exclut le vol partiel — risque élevé en zone urbaine de Yaoundé selon l'historique sinistres.";

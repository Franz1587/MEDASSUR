// Lettrage interne — comptes clients (souscripteurs) et fournisseurs
// (prestataires) — 2026-09. Voir backend/src/lettrage/lettrage.util.ts,
// moteur partagé aussi utilisé par le lettrage du compte 411 côté Super
// Admin (src/types/societes.ts, LettrageSociete).

export interface MouvementLettrage {
  id: string;
  date: string;
  libelle: string;
  montant: number;
  lettre: string | null;
}

export interface LettrageClient {
  clientId: string;
  clientNom: string;
  mouvements: MouvementLettrage[];
  soldeNonLettre: number;
  lettrageComplet: boolean;
}

export interface LettrageFournisseur {
  prestataireId: string;
  prestataireNom: string;
  mouvements: MouvementLettrage[];
  soldeNonLettre: number;
  lettrageComplet: boolean;
}

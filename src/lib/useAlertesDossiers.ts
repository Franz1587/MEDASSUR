import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { jouerSonNotification } from "@/lib/sonNotification";

// Bulles + son de relance, généralisées à tout "dossier" avec une notion de
// prise en charge (2026-09) — voir demande utilisateur : "étendre le fait
// de prendre en main un dossier aux agents de saisie, gestionnaire sinistre
// et gestionnaires production" + "toutes les 5 minutes elles doivent se
// comporter comme des nouveaux messages". Même principe et même correctif
// que lib/useAlertesMessagerie.ts (horloge PAR dossier, pas une horloge
// globale — voir son commentaire pour le bug que ça évite), généralisé ici
// pour être réutilisable sur n'importe quelle liste de dossiers réclamables
// (prises en charge, demandes client...) sans dupliquer toute la mécanique.
const POLL_MS = 20_000;
const RAPPEL_NON_PRISE_MS = 5 * 60 * 1000;

export interface DossierAlertable {
  id: string;
  titre: string;
  // true = personne ne s'en occupe ET le dossier est encore dans un état
  // où quelqu'un DEVRAIT s'en occuper (ex. decision/statut "En attente").
  // Piloté par l'appelant plutôt que déduit ici : chaque module a son
  // propre vocabulaire de statuts (voir accord-prealable "decision",
  // demandes-client "statut").
  enAttente: boolean;
}

interface OptionsAlertesDossiers {
  recuperer: () => Promise<DossierAlertable[]>;
  // Libellé de la bulle "nouveau dossier" (jamais affichée pour le tout
  // premier chargement, seulement pour un id apparu depuis).
  labelNouveau: (d: DossierAlertable) => string;
  // Libellé de la bulle de relance (dossier en attente depuis ≥ 5 min).
  labelRelance: (d: DossierAlertable) => string;
  onOuvrir?: (id?: string) => void;
  actif?: boolean; // ex. false pour un rôle sans accès au module concerné
}

export function useAlertesDossiers({ recuperer, labelNouveau, labelRelance, onOuvrir, actif = true }: OptionsAlertesDossiers): void {
  const idsConnus = useRef<Set<string>>(new Set());
  const derniereAlerte = useRef<Map<string, number>>(new Map());
  const premierChargement = useRef(true);
  const recupererRef = useRef(recuperer);
  recupererRef.current = recuperer;
  const labelNouveauRef = useRef(labelNouveau);
  labelNouveauRef.current = labelNouveau;
  const labelRelanceRef = useRef(labelRelance);
  labelRelanceRef.current = labelRelance;
  const onOuvrirRef = useRef(onOuvrir);
  onOuvrirRef.current = onOuvrir;

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    let enCours = false;

    const verifier = async () => {
      if (enCours) return;
      enCours = true;
      let dossiers: DossierAlertable[];
      try {
        dossiers = await recupererRef.current();
      } catch {
        enCours = false;
        return; // silencieux — un échec réseau ponctuel ne doit jamais spammer d'erreur
      }
      enCours = false;
      if (annule) return;

      const maintenant = Date.now();
      for (const d of dossiers) {
        const estNouveau = !premierChargement.current && !idsConnus.current.has(d.id);
        idsConnus.current.add(d.id);

        const derniereFois = derniereAlerte.current.get(d.id) ?? 0;
        const relanceDue = d.enAttente && maintenant - derniereFois >= RAPPEL_NON_PRISE_MS;

        if (!d.enAttente) derniereAlerte.current.delete(d.id);

        if (estNouveau) {
          toast(labelNouveauRef.current(d), {
            duration: 9000,
            action: { label: "Ouvrir", onClick: () => onOuvrirRef.current?.(d.id) },
          });
          jouerSonNotification();
          derniereAlerte.current.set(d.id, maintenant);
        } else if (relanceDue) {
          toast.warning(labelRelanceRef.current(d), {
            duration: 12000,
            action: { label: "Ouvrir", onClick: () => onOuvrirRef.current?.(d.id) },
          });
          jouerSonNotification();
          derniereAlerte.current.set(d.id, maintenant);
        }
      }
      premierChargement.current = false;
    };

    verifier();
    const id = setInterval(verifier, POLL_MS);
    const surVisibilite = () => { if (document.visibilityState === "visible") verifier(); };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("focus", surVisibilite);
    return () => {
      annule = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("focus", surVisibilite);
    };
    // recuperer/labelNouveau/labelRelance/onOuvrir lus via ref pour ne
    // jamais réinitialiser l'intervalle (voir useAlertesMessagerie.ts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);
}

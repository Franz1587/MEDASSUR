import { useEffect, useState } from "react";
import { ecouterRequetesEnVol, requetesEnVolActuelles } from "@/lib/http";
import logoMark from "@/assets/logo-mark.png";

// Léger délai avant d'afficher l'overlay (2026-09) — voir demande
// utilisateur : "tant que les données de la page ne sont pas encore
// affichées, une page transparente avec une barre de chargement". Une
// réponse quasi instantanée (cache, petite liste) ne doit jamais faire
// clignoter l'overlay — seules les lectures qui prennent réellement du
// temps le déclenchent. Le masquage est lui aussi légèrement différé pour
// ne pas clignoter entre deux requêtes enchaînées (ex. contrat puis sa
// population).
const DELAI_AFFICHAGE_MS = 180;
const DELAI_MASQUAGE_MS = 150;

// Overlay de chargement de page — unique, monté une seule fois à la racine
// de l'app (voir App.tsx), piloté par le compteur RÉEL de lectures réseau
// en vol (voir lib/http.ts) plutôt que par un minuteur factice : chaque
// page bénéficie du même rendu soigné sans avoir à gérer son propre état
// de chargement pour ça.
export function PageLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enCours = () => requetesEnVolActuelles() > 0;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    const planifier = () => {
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => setVisible(enCours()), enCours() ? DELAI_AFFICHAGE_MS : DELAI_MASQUAGE_MS);
    };

    planifier();
    const desabonner = ecouterRequetesEnVol(planifier);
    return () => {
      desabonner();
      if (minuteur) clearTimeout(minuteur);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={`page-loader-overlay ${visible ? "page-loader-overlay--visible" : ""}`}
    >
      <div className="page-loader-card">
        <img src={logoMark} alt="" className="page-loader-mark" />
        <div className="page-loader-track">
          <span className="page-loader-bar page-loader-bar-1" />
          <span className="page-loader-bar page-loader-bar-2" />
        </div>
        <p className="page-loader-caption">Chargement des données…</p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Shield, FileText, HeartPulse, Stethoscope } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import { useAuth } from "@/auth/AuthContext";

// Textes de consentement par famille de rôle (2026-10) — voir demande
// utilisateur : "une clause de consentement adaptée à son profil donnant
// l'autorisation de récolter et stocker ses données". Affiché une SEULE
// fois au premier usage (voir User.consentementAccepteAt). Trois profils :
// - Assuré : données de santé personnelles et de l'ayant droit
// - Professionnel de santé (médecin, prestataire) : données professionnelles
// - Client/Souscripteur : données contractuelles et financières
const PROFIL_CONTENU: Record<string, { titre: string; icone: React.ReactNode; clauses: string[] }> = {
  assure: {
    titre: "Protection de vos données de santé",
    icone: <HeartPulse className="w-8 h-8 text-primary" strokeWidth={1.5} />,
    clauses: [
      "Les données personnelles vous concernant (nom, prénom, date de naissance, coordonnées) sont collectées pour assurer la gestion de votre couverture santé.",
      "Vos données de santé (consultations, ordonnances, résultats d'examens, actes médicaux) sont traitées dans le strict respect du secret médical et uniquement pour la gestion de vos remboursements et prises en charge.",
      "Les données de vos ayants droit (conjoint, enfants) bénéficient des mêmes protections. Vous confirmez avoir leur accord pour leur inscription et le traitement de leurs données.",
      "Vos données sont conservées pendant la durée de votre couverture et 5 ans après la résiliation, conformément à la réglementation gabonaise.",
      "Vous bénéficiez d'un droit d'accès, de rectification et d'opposition à vos données auprès de votre société d'assurance.",
      "En cas de résiliation, l'accès à l'historique de vos données via la plateforme MEDASSUR+ peut être maintenu sur abonnement individuel annuel.",
    ],
  },
  professionnel: {
    titre: "Traitement de vos données professionnelles",
    icone: <Stethoscope className="w-8 h-8 text-primary" strokeWidth={1.5} />,
    clauses: [
      "Vos données professionnelles (nom, spécialité, numéro de convention, coordonnées de l'établissement) sont collectées pour gérer vos relations contractuelles avec les organismes assureurs.",
      "Les données de facturation et de prestations que vous saisissez sont transmises aux organismes assureurs concernés dans le cadre du tiers payant.",
      "Les prescriptions et actes médicaux enregistrés sur la plateforme sont couverts par le secret professionnel et ne sont accessibles qu'aux parties autorisées (assuré, assureur, organismes de contrôle).",
      "Vous êtes responsable de la confidentialité des identifiants de connexion de votre établissement et des comptes génériques mis à votre disposition.",
      "Vos données sont conservées pendant la durée de votre convention et 10 ans après sa résiliation à des fins de contrôle et de traçabilité.",
    ],
  },
  client: {
    titre: "Traitement de vos données contractuelles",
    icone: <FileText className="w-8 h-8 text-primary" strokeWidth={1.5} />,
    clauses: [
      "Les données de votre organisation (raison sociale, coordonnées, représentants légaux) sont collectées pour la gestion de votre contrat d'assurance collective.",
      "Les données de vos employés/membres affiliés sont traitées exclusivement dans le cadre de la gestion de leurs droits et remboursements.",
      "Vous confirmez être autorisé(e) à transmettre les données de vos affiliés à la plateforme MEDASSUR+ et à votre société d'assurance.",
      "Les données financières (cotisations, primes, situations d'exercice) sont conservées conformément aux obligations légales gabonaises en matière comptable.",
      "Vous disposez d'un droit d'accès et de rectification des données de votre organisation auprès de votre interlocuteur assureur.",
    ],
  },
};

function profilPourRole(roleId: string): keyof typeof PROFIL_CONTENU {
  if (roleId === "assure_principal") return "assure";
  if (roleId === "medecin_prescripteur" || roleId === "prestataire_sante") return "professionnel";
  return "client";
}

const CLE_CONSENTEMENT = (userId: string) => `medassur-consentement-${userId}`;

// Bloque tout l'écran tant que l'utilisateur n'a pas accepté. Ne peut PAS
// être fermé sans cliquer "J'accepte" — seule la déconnexion permet de
// sortir sans accepter. Affiché UNIQUEMENT une fois par compte (stocké en
// localStorage tant que la migration User.consentementAccepteAt n'est pas
// appliquée en prod — voir PortalShell.tsx).
export function ConsentementModal({ userId }: { userId: string }) {
  const { currentUser, accepterConsentement, logout } = useAuth();
  const [coche, setCoche] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [accepted, setAccepted] = useState(() => {
    try { return !!localStorage.getItem(CLE_CONSENTEMENT(userId)); } catch { return false; }
  });

  if (!currentUser || accepted) return null;
  const profil = profilPourRole(currentUser.roleId);
  const contenu = PROFIL_CONTENU[profil];

  const valider = async () => {
    if (!coche) return;
    setEnCours(true);
    try {
      await accepterConsentement();
      try { localStorage.setItem(CLE_CONSENTEMENT(userId), new Date().toISOString()); } catch { /* quota */ }
      setAccepted(true);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="p-6 border-b border-border flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {contenu.icone}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Consentement requis</span>
            </div>
            <h2 className="text-[1rem] font-bold text-foreground leading-snug">{contenu.titre}</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Avant de continuer, veuillez lire et accepter les conditions de traitement de vos données.
            </p>
          </div>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {contenu.clauses.map((clause, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-[12.5px] text-foreground leading-relaxed">{clause}</p>
            </div>
          ))}

          <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Cette acceptation est enregistrée avec la date et l'heure de votre premier accès. Elle peut être consultée
              auprès de votre société d'assurance. Conformément à la loi gabonaise sur la protection des données
              personnelles, vous disposez d'un droit d'accès, de rectification et d'opposition à vos données.
            </p>
          </div>
        </div>

        {/* Pied */}
        <div className="p-5 border-t border-border space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={coche}
              onChange={(e) => setCoche(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
            />
            <span className="text-[12.5px] text-foreground leading-snug group-hover:text-primary transition-colors">
              J'ai lu et j'accepte les conditions de traitement de mes données personnelles décrites ci-dessus.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={logout}
              className="h-9 px-4 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              Me déconnecter
            </button>
            <Btn
              variant="primary"
              className="flex-1"
              onClick={valider}
              disabled={!coche || enCours}
            >
              {enCours ? "Enregistrement…" : "J'accepte et je continue"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, MessageSquareText, UserPlus, Copy, Check } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import {
  getComptesPortailPrestataire, creerComptePortailPrestataire, reinitialiserMotDePassePortailPrestataire,
  type ComptePortailPoste, type IdentifiantsPortail,
} from "@/services/prestataires.service";

// Onglet "Portail" de la fiche prestataire (2026-09) — voir demande
// utilisateur : "pour chaque prestataire de la ruche excellence, il faut
// créer des compte utilisateurs génériques pour chaque structure
// médicale... fais apparaitre ces données dans le profil de chaque
// prestataire du réseau dans un onglet portail du prestataire" puis
// "Service Accueil... Service Facturation... Médecin... pour les
// pharmacies... remplacer service.accueil par vendeur et medecin par
// pharmacien" — 3 comptes distincts par établissement, jamais un seul. Le
// mot de passe n'est JAMAIS stocké en clair — affiché une seule fois juste
// après création/réinitialisation (même principe que Super Admin →
// Utilisateurs → réinitialiser).
export function PortailTab({ prestataireId }: { prestataireId: string }) {
  const [postes, setPostes] = useState<ComptePortailPoste[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [identifiants, setIdentifiants] = useState<{ poste: string; data: IdentifiantsPortail } | null>(null);
  const [copie, setCopie] = useState(false);

  const rafraichir = () => {
    setChargement(true);
    getComptesPortailPrestataire(prestataireId).then(setPostes).catch(() => undefined).finally(() => setChargement(false));
  };
  useEffect(() => { setIdentifiants(null); rafraichir(); }, [prestataireId]);

  const creer = async (poste: string) => {
    setEnCours(poste);
    try {
      const res = await creerComptePortailPrestataire(prestataireId, poste);
      setIdentifiants({ poste, data: res });
      rafraichir();
      toast.success(res.smsEnvoye ? "Compte créé — identifiants envoyés par SMS." : "Compte créé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création du compte impossible.");
    } finally {
      setEnCours(null);
    }
  };

  const reinitialiser = async (poste: string, label: string) => {
    if (!window.confirm(`Générer un nouveau mot de passe pour le compte "${label}" ?`)) return;
    setEnCours(poste);
    try {
      const res = await reinitialiserMotDePassePortailPrestataire(prestataireId, poste);
      setIdentifiants({ poste, data: res });
      toast.success(res.smsEnvoye ? "Mot de passe réinitialisé — envoyé par SMS." : "Mot de passe réinitialisé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Réinitialisation impossible.");
    } finally {
      setEnCours(null);
    }
  };

  const copier = async (data: IdentifiantsPortail) => {
    try {
      await navigator.clipboard.writeText(`Identifiant : ${data.email}\nMot de passe : ${data.motDePasse}`);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Copie impossible.");
    }
  };

  if (chargement || !postes) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Trois comptes portail génériques et partagés par cet établissement — pas des comptes individuels. Ils permettent de
        tester en production que les prises en charge, factures et remboursements saisis depuis le Portail Prestataire
        remontent bien côté administration.
      </p>

      <div className="space-y-3">
        {postes.map((p) => (
          <div key={p.poste} className="rounded-lg border border-border p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground">{p.label}</p>
                {p.existe ? (
                  <p className="text-[12px] text-muted-foreground truncate" style={{ fontFamily: "'DM Mono', monospace" }}>{p.email}</p>
                ) : (
                  <p className="text-[12px] text-muted-foreground">Aucun compte créé</p>
                )}
              </div>
              {p.existe ? (
                <Btn variant="secondary" onClick={() => reinitialiser(p.poste, p.label)} disabled={enCours === p.poste}>
                  {enCours === p.poste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  Réinitialiser
                </Btn>
              ) : (
                <Btn variant="primary" onClick={() => creer(p.poste)} disabled={enCours === p.poste}>
                  {enCours === p.poste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Créer
                </Btn>
              )}
            </div>

            {identifiants?.poste === p.poste && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
                <p className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <MessageSquareText className="w-3.5 h-3.5 text-primary" />
                  {identifiants.data.smsEnvoye ? "Identifiants envoyés par SMS — également affichés ici" : "Identifiants (aucun SMS envoyé — pas de téléphone renseigné)"}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Identifiant : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{identifiants.data.email}</span>
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Mot de passe : <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{identifiants.data.motDePasse}</span>
                </p>
                <p className="text-[11px] text-amber-500">Ce mot de passe ne sera plus jamais affiché — notez-le ou communiquez-le maintenant.</p>
                <button
                  type="button" onClick={() => copier(identifiants.data)}
                  className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"
                >
                  {copie ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copie ? "Copié" : "Copier"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

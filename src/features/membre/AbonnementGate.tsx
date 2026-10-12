import { useEffect, useState } from "react";
import { ShieldOff, CheckCircle2, BookOpen, History, HeartPulse, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getStatutAccesMembre, demanderAbonnementIndividuel, type StatutAccesMembre } from "@/services/portailMembre.service";

// Avantages inclus dans l'abonnement individuel
const AVANTAGES = [
  { icone: <History className="w-4 h-4 text-primary" />, titre: "Historique de vos prestations", detail: "Consultez toutes vos prises en charge et remboursements passés" },
  { icone: <BookOpen className="w-4 h-4 text-primary" />, titre: "E-carnet Santé", detail: "Importez et conservez vos ordonnances, examens et comptes rendus médicaux" },
  { icone: <HeartPulse className="w-4 h-4 text-primary" />, titre: "Passeport médical", detail: "Accédez à vos informations d'urgence (groupe sanguin, allergies, traitements)" },
];

// Gate affichée aux assurés dont le statut ne permet plus l'accès normal
// (Suspendu, Radié, Suspendu (radié)) — voir portail-membre.controller.ts
// GET /statut-acces. Reste visible même après connexion : l'assuré voit
// le message et le tarif, peut demander l'abonnement, mais n'accède pas
// à ses données tant que l'abonnement n'est pas activé par l'admin.
export function AbonnementGate() {
  const [statut, setStatut] = useState<StatutAccesMembre | null>(null);
  const [chargement, setChargement] = useState(true);
  const [demande, setDemande] = useState(false);
  const [dejaDemandeOuActif, setDejaDemandeOuActif] = useState(false);

  useEffect(() => {
    getStatutAccesMembre()
      .then((s) => {
        setStatut(s);
        setDejaDemandeOuActif(s.abonnementActif || false);
      })
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, []);

  const handleDemande = async () => {
    setDemande(true);
    try {
      const res = await demanderAbonnementIndividuel();
      toast.success(res.message);
      setDejaDemandeOuActif(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demande impossible.");
    } finally {
      setDemande(false);
    }
  };

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Icône + message principal */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldOff className="w-8 h-8 text-destructive" strokeWidth={1.5} />
          </div>
          <h1 className="text-[1.1rem] font-bold text-foreground">Votre compte n'est plus lié à un contrat actif</h1>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            {statut?.statut === "Radié"
              ? "Vous avez été radié(e) de votre contrat d'assurance collective."
              : "Votre affiliation à votre contrat d'assurance collective est actuellement suspendue."}
            {" "}Pour retrouver l'accès à votre historique et à vos données de santé, vous pouvez souscrire un abonnement annuel individuel.
          </p>
        </div>

        {/* Tarif + bouton */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Abonnement individuel annuel</p>
              <p className="text-[11.5px] text-muted-foreground">Accès à votre espace personnel pour 1 an</p>
            </div>
            {statut?.prixAnnuelXaf != null ? (
              <p className="text-[1.15rem] font-bold text-primary flex-shrink-0">{fmtM(statut.prixAnnuelXaf)}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Tarif non renseigné</p>
            )}
          </div>

          {dejaDemandeOuActif ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700 dark:text-amber-400">
                Demande en attente de validation par votre société d'assurance.
              </p>
            </div>
          ) : statut?.prixAnnuelXaf != null ? (
            <Btn variant="primary" className="w-full" onClick={handleDemande} disabled={demande}>
              {demande ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Demander l'abonnement
            </Btn>
          ) : null}
        </div>

        {/* Avantages */}
        <div className="space-y-2.5">
          <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide">Ce que vous obtenez</p>
          {AVANTAGES.map((a, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                {a.icone}
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground">{a.titre}</p>
                <p className="text-[11.5px] text-muted-foreground">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Une fois votre demande validée par votre société d'assurance, l'accès sera rétabli automatiquement.
        </p>
      </div>
    </div>
  );
}

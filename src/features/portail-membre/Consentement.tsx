import { useEffect, useState } from "react";
import { ShieldCheck, FileDown, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { getMoi } from "@/services/maSignature.service";
import { openDocument } from "@/services/documents.service";
import type { UserAccount } from "@/types/admin";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MembreConsentementView() {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [telechargement, setTelechargement] = useState(false);

  useEffect(() => {
    getMoi().then(setUser).catch(() => undefined);
  }, []);

  const telecharger = async () => {
    if (!user) return;
    setTelechargement(true);
    try {
      await openDocument(`/users/${user.id}/attestation-consentement`);
    } catch {
      toast.error("Génération de l'attestation impossible.");
    } finally {
      setTelechargement(false);
    }
  };

  const accepte = !!user?.consentementAccepteAt;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-foreground">Protection des données</h1>
          <p className="text-[12.5px] text-muted-foreground">Politique de confidentialité et consentement RGPD</p>
        </div>
      </div>

      <div className={`rounded-xl border p-5 flex items-start gap-4 ${accepte ? "border-green-500/30 bg-green-50 dark:bg-green-950/20" : "border-amber-400/30 bg-amber-50 dark:bg-amber-950/20"}`}>
        {accepte ? (
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <p className={`text-[13.5px] font-medium ${accepte ? "text-green-800 dark:text-green-200" : "text-amber-800 dark:text-amber-200"}`}>
            {accepte ? "Consentement enregistré" : "Consentement en attente"}
          </p>
          {accepte && user?.consentementAccepteAt ? (
            <p className="text-[12.5px] text-muted-foreground">
              Vous avez accepté la politique de confidentialité le{" "}
              <span className="font-medium text-foreground">{formatDate(user.consentementAccepteAt)}</span>.
            </p>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">
              Votre consentement n'a pas encore été enregistré. Il vous sera demandé à votre prochaine connexion.
            </p>
          )}
        </div>
      </div>

      {accepte && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-[13px] text-foreground font-medium">Attestation d'acceptation</p>
          <p className="text-[12.5px] text-muted-foreground">
            Téléchargez votre attestation officielle confirmant que vous avez pris connaissance et accepté
            la politique de protection des données personnelles de MEDASSUR+.
          </p>
          <button
            type="button"
            onClick={telecharger}
            disabled={telechargement || !user}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-60"
          >
            <FileDown className="w-4 h-4" />
            {telechargement ? "Génération…" : "Télécharger l'attestation PDF"}
          </button>
        </div>
      )}

      <div className="bg-secondary/30 rounded-xl border border-border p-4 space-y-2">
        <p className="text-[12px] font-semibold text-foreground uppercase tracking-wide">Vos droits</p>
        <ul className="space-y-1 text-[12.5px] text-muted-foreground list-disc list-inside">
          <li>Droit d'accès à vos données personnelles</li>
          <li>Droit de rectification des informations inexactes</li>
          <li>Droit à la portabilité de vos données</li>
          <li>Droit d'opposition au traitement</li>
        </ul>
        <p className="text-[12px] text-muted-foreground pt-1">
          Pour exercer vos droits, contactez votre gestionnaire ou l'administrateur de votre société.
        </p>
      </div>
    </div>
  );
}

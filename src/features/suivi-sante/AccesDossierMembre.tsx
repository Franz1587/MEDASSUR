import { useEffect, useState } from "react";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fermerAccesDossier, getAccesDossier, nomMedecin, ouvrirAccesDossier, type AccesDossier } from "@/services/suiviSante.service";
import { carte, ChoixBeneficiaire, ChoixProfessionnel, useBeneficiaires, type ChoixPro } from "./commun";

// Accès au dossier médical (2026-11) — voir demande utilisateur : "un
// patient doit pouvoir ouvrir l'accès à son dossier patient à un médecin et
// pouvoir fermer l'accès… dès qu'il donne accès au médecin, ce dernier
// reçoit une notification, de même lorsque le patient ferme l'accès."
export default function MembreAccesDossierView() {
  const beneficiaires = useBeneficiaires();
  const [acces, setAcces] = useState<AccesDossier[] | null>(null);
  const [assureId, setAssureId] = useState("");
  const [pro, setPro] = useState<ChoixPro | null>(null);

  const charger = () => getAccesDossier().then(setAcces).catch(() => setAcces([]));
  useEffect(() => { charger(); }, []);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);

  const changer = async (assure: string, medecinId: string, ouvrir: boolean) => {
    try {
      await (ouvrir ? ouvrirAccesDossier(assure, medecinId) : fermerAccesDossier(assure, medecinId));
      toast.success(ouvrir ? "Accès ouvert : le médecin a été prévenu." : "Accès fermé : le médecin a été prévenu.");
      setPro(null);
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opération impossible.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Accès à mon dossier</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Vous décidez quels médecins consultent votre dossier médical (consultations, ordonnances, examens, documents du carnet, constantes). Vous pouvez fermer l'accès à tout moment.
        </p>
      </div>

      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />Donner l'accès à un médecin</p>
        <div className="sm:w-80"><ChoixBeneficiaire liste={beneficiaires} valeur={assureId} onChange={setAssureId} /></div>
        <ChoixProfessionnel valeur={pro} onChange={setPro} />
        <button type="button" disabled={!pro?.medecin} onClick={() => pro?.medecin && changer(assureId, pro.medecin.id, true)} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60">
          <LockOpen className="w-4 h-4" />Ouvrir mon dossier{pro?.medecin ? ` à ${pro.libelle}` : ""}
        </button>
      </div>

      <h2 className="text-[14px] font-semibold text-foreground">Médecins autorisés</h2>
      {acces === null ? <p className="text-[12.5px] text-muted-foreground">Chargement…</p>
        : acces.length === 0 ? <p className="text-[12.5px] text-muted-foreground">Aucun médecin n'a accès à votre dossier.</p>
        : (
          <div className="space-y-2">
            {acces.map((a) => (
              <div key={a.id} className="bg-card border border-border rounded-xl p-3.5 flex flex-wrap items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${a.actif ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                  {a.actif ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">{nomMedecin(a.medecin)} <span className="text-muted-foreground font-normal">· {a.medecin.specialite ?? "Médecine générale"}</span></p>
                  <p className="text-[11.5px] text-muted-foreground">
                    Dossier de {a.assure.prenom ?? ""} {a.assure.nom} · {a.actif ? `ouvert depuis le ${new Date(a.ouvertLe).toLocaleDateString("fr-FR")}` : `fermé le ${new Date(a.fermeLe!).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <button type="button" onClick={() => changer(a.assureId, a.medecinId, !a.actif)} className={`h-8 px-3 rounded-lg text-[12px] font-medium border ${a.actif ? "border-red-300 text-red-700 hover:bg-red-50" : "border-primary/40 text-primary hover:bg-primary/10"}`}>
                  {a.actif ? "Fermer l'accès" : "Rouvrir"}
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

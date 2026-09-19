import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListOrdered, User, Building2, ArrowRight } from "lucide-react";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { getMoiMedecin, getFileAttente, type MedecinMoi, type PatientEnAttente } from "@/services/portailMedecin.service";

// Handoff vers l'écran Consultation (2026-08) — même principe que
// PRESTATION_HANDOFF_KEY (src/features/portail-prestataire/prestationTypes.ts) :
// un clic sur "Consulter" transmet directement la consultation choisie,
// sans re-fetch — voir MedecinPrescripteur.tsx.
export const MEDECIN_HANDOFF_KEY = "medassur-medecin-handoff";

// File d'attente (2026-08) — voir demande utilisateur : "il n'a pas besoin
// d'identifier un assuré, il doit en se connectant voir la liste des
// assurés qu'il doit recevoir (une file d'attente)". Page d'accueil du
// portail médecin — consultations déjà facturées par SA/SES structure(s),
// pas encore prescrites.
export default function MedecinFileAttenteView() {
  const { setView } = useShellNavigation();
  const [moi, setMoi] = useState<MedecinMoi | null>(null);
  const [attente, setAttente] = useState<PatientEnAttente[] | null>(null);

  useEffect(() => {
    getMoiMedecin().then(setMoi).catch(() => undefined);
    getFileAttente().then(setAttente).catch((err) => toast.error(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  const consulter = (patient: PatientEnAttente) => {
    sessionStorage.setItem(MEDECIN_HANDOFF_KEY, JSON.stringify(patient));
    setView("prestataireMedecinPrescripteur");
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><ListOrdered className="w-5 h-5 text-primary" />File d'attente</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          {moi ? `Bienvenue ${moi.titre ? `${moi.titre} ` : ""}${moi.nom}${moi.prenom ? ` ${moi.prenom}` : ""}` : "Consultations en attente de prescription."}
        </p>
      </div>

      {!attente ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : attente.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun patient en attente pour l'instant.</div>
      ) : (
        <div className="space-y-2">
          {attente.map((p) => (
            <button
              key={p.id} type="button" onClick={() => consulter(p)}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3.5 text-left hover:border-primary/40 hover:bg-secondary/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-primary" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground truncate">{p.assureNom}</p>
                <p className="text-[11.5px] text-muted-foreground">{p.acteLibelle ?? p.type} · {p.date}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" />{p.prestataireNom}</p>
              </div>
              <span className="text-[11.5px] font-medium text-primary flex items-center gap-1 flex-shrink-0">Consulter<ArrowRight className="w-3.5 h-3.5" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

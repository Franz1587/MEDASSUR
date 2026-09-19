import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Search, RotateCcw, User } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { assurePhotoUrl } from "@/services/sante.service";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { getMesPatients, type PatientDetail, type PatientFamilleMembre } from "@/services/portailPrestataire.service";
import { IdentificationAssure } from "./IdentificationAssure";
import { PRESTATION_HANDOFF_KEY } from "./prestationTypes";

const LABEL_TYPE: Record<string, string> = { AS: "Bénéficiaire Principal", CJ: "Conjoint(e)", EF: "Enfant" };

type Vue = "liste" | "identification";

// "Mes patients" + identification (2026-08) — voir demande utilisateur :
// "ajouter des filtres dans les écrans patient pour qu'on puisse rechercher
// un patient déjà existant... ayant déjà été servi au moins une fois par le
// prestataire. Dans la liste des patients doit voir s'il est encore actif
// ou s'il est déjà désactivé" puis "si un patient apparaît dans la liste
// des patients comme ça, on ne l'identifie plus, mais on crée une nouvelle
// prestation, étant donné qu'on peut déjà le rechercher et que son statut
// réel remonte en temps réel" — un clic ouvre directement sa fiche (voir
// IdentificationAssure patientDirect), le blocage "non couvert" restant
// appliqué si son statut n'est plus "Actif".
export default function PrestatairePatientsView() {
  const { setView } = useShellNavigation();
  const [vue, setVue] = useState<Vue>("liste");
  const [patients, setPatients] = useState<PatientFamilleMembre[] | null>(null);
  // Saisie des critères (2026-08) — voir demande utilisateur : "je veux...
  // le bouton rechercher pour lancer la requête" : le filtre ne s'applique
  // qu'au clic sur "Rechercher", jamais à la frappe.
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("");
  const [patientDirect, setPatientDirect] = useState<string | undefined>();

  useEffect(() => { getMesPatients().then(setPatients); }, []);

  const patientsFiltres = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return patients ?? [];
    return (patients ?? []).filter((p) =>
      `${p.nom} ${p.prenom ?? ""}`.toLowerCase().includes(q) || p.matricule.toLowerCase().includes(q));
  }, [patients, filtre]);
  const lancerRecherche = () => setFiltre(recherche);
  const reinitialiserRecherche = () => { setRecherche(""); setFiltre(""); };

  const nouvellePrestation = (patient: PatientDetail, groupeActe: string) => {
    sessionStorage.setItem(PRESTATION_HANDOFF_KEY, JSON.stringify({ patientId: patient.id, groupeActe }));
    setView("prestatairePrestations");
  };

  const ouvrirPourPrestation = (p: PatientFamilleMembre) => {
    if (p.statut !== "Actif") {
      toast.error("Désolé, prestation impossible pour ce patient car il n'est plus couvert.");
      return;
    }
    setPatientDirect(p.id);
    setVue("identification");
  };

  if (vue === "identification") {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={() => setVue("liste")} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à mes patients
        </button>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Patients</h1>
        <IdentificationAssure onNouvellePrestation={nouvellePrestation} patientDirect={patientDirect} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Patients</h1>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-foreground">Mes patients</p>
          <button type="button" onClick={() => { setPatientDirect(undefined); setVue("identification"); }} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium">
            Identifier un nouvel assuré
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={recherche} onChange={(e) => setRecherche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRecherche()}
            placeholder="Rechercher (nom, matricule)…"
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
          />
          <button type="button" onClick={lancerRecherche} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5 flex-shrink-0">
            <Search className="w-3.5 h-3.5" />Rechercher
          </button>
          {filtre && (
            <button type="button" onClick={reinitialiserRecherche} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 flex-shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
            </button>
          )}
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-2">Patient</th>
                <th className="text-left px-3 py-2">Matricule</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {patientsFiltres.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/25 cursor-pointer" onClick={() => ouvrirPourPrestation(p)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {assurePhotoUrl(p.photo) ? <img src={assurePhotoUrl(p.photo)} alt="" className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <span className="text-foreground font-medium">{p.nom} {p.prenom ?? ""}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{p.matricule}</td>
                  <td className="px-3 py-2 text-muted-foreground">{LABEL_TYPE[p.typeAssure ?? ""] ?? p.typeAssure ?? "—"}</td>
                  <td className="px-3 py-2"><Badge variant={p.statut === "Actif" ? "success" : "danger"}>{p.statut === "Actif" ? "Actif" : "Non couvert"}</Badge></td>
                  <td className="px-3 py-2 text-right text-primary text-[11.5px]">Nouvelle prestation →</td>
                </tr>
              ))}
              {patients && patientsFiltres.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{filtre ? "Aucun patient ne correspond à cette recherche." : "Aucun patient servi pour l'instant."}</td></tr>
              )}
              {!patients && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Chargement…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

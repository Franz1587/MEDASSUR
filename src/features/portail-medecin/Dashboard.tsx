import { useEffect, useMemo, useState } from "react";
import { ListOrdered, FolderClock, History, Stethoscope } from "lucide-react";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { getMoiMedecin, getFileAttente, getMesPrescriptions, type MedecinMoi, type PatientEnAttente, type Prescription } from "@/services/portailMedecin.service";

function parseDate(date: string): number {
  const [j, m, a] = date.split("/").map(Number);
  if (!j || !m || !a) return 0;
  return new Date(a, m - 1, j).getTime();
}

// Tableau de bord du médecin (2026-08) — voir demande utilisateur : "il
// doit avoir aussi un tableau de bord avec des statistiques de ses actions
// et les boutons d'accès rapide à ses fonctionnalités."
export default function MedecinDashboardView() {
  const { setView } = useShellNavigation();
  const [moi, setMoi] = useState<MedecinMoi | null>(null);
  const [fileAttente, setFileAttente] = useState<PatientEnAttente[] | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);

  useEffect(() => {
    getMoiMedecin().then(setMoi);
    getFileAttente().then(setFileAttente);
    getMesPrescriptions().then(setPrescriptions);
  }, []);

  const stats = useMemo(() => {
    if (!prescriptions) return null;
    const patientsUniques = new Set(prescriptions.map((p) => p.assureId)).size;
    const maintenant = new Date();
    const ceMois = prescriptions.filter((p) => {
      const t = parseDate(p.date);
      if (!t) return false;
      const d = new Date(t);
      return d.getMonth() === maintenant.getMonth() && d.getFullYear() === maintenant.getFullYear();
    }).length;
    const lignesEnAttente = prescriptions.reduce((n, p) => n + p.lignes.filter((l) => l.statut === "EnAttente").length, 0);
    return { patientsUniques, totalConsultations: prescriptions.length, ceMois, lignesEnAttente };
  }, [prescriptions]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Tableau de bord</h1>
        {moi && (
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {moi.titre ?? "Dr"} {moi.nom} {moi.prenom ?? ""}{moi.specialite ? ` — ${moi.specialite}` : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl">
        <button
          type="button" onClick={() => setView("medecinFileAttente")}
          className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <ListOrdered className="w-10 h-10 text-primary" strokeWidth={1.5} />
          <span className="text-[13px] font-semibold text-foreground">File d'attente</span>
          {fileAttente && <span className="text-[11px] text-muted-foreground">{fileAttente.length} patient{fileAttente.length > 1 ? "s" : ""} en attente</span>}
        </button>
        <button
          type="button" onClick={() => setView("medecinDossiersPatients")}
          className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <FolderClock className="w-10 h-10 text-primary" strokeWidth={1.5} />
          <span className="text-[13px] font-semibold text-foreground">Mes Dossiers Patients</span>
        </button>
        <button
          type="button" onClick={() => setView("medecinHistoriquePrestations")}
          className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
        >
          <History className="w-10 h-10 text-primary" strokeWidth={1.5} />
          <span className="text-[13px] font-semibold text-foreground">Historique des prestations</span>
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-5xl">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Patients suivis</p>
            <p className="text-[18px] font-bold text-foreground mt-1">{stats.patientsUniques}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Consultations totales</p>
            <p className="text-[18px] font-bold text-foreground mt-1">{stats.totalConsultations}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Ce mois-ci</p>
            <p className="text-[18px] font-bold text-primary mt-1">{stats.ceMois}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground">Lignes en attente</p>
            <p className="text-[18px] font-bold text-amber-600 mt-1">{stats.lignesEnAttente}</p>
          </div>
        </div>
      )}

      {moi && moi.structures.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 max-w-5xl">
          <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5 mb-3"><Stethoscope className="w-4 h-4 text-primary" />Vos structures</p>
          <div className="flex flex-wrap gap-2">
            {moi.structures.map((s) => (
              <span key={s.id} className="px-2.5 py-1 rounded-full bg-secondary/40 border border-border text-[12px] text-foreground">{s.nom} — {s.ville}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

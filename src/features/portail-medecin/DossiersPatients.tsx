import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FolderClock, Pill, FlaskConical, User, FileDown } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import {
  getMesPrescriptions, ouvrirFeuilleSoinsPrescription, ouvrirFeuilleExamenPrescription,
  type Prescription,
} from "@/services/portailMedecin.service";

interface PatientDossier {
  assureId: string;
  assureNom: string;
  assureMatricule: string;
  nbConsultations: number;
  derniereDate: string;
  prescriptions: Prescription[];
}

// Année d'une date "jj/mm/aaaa" (même convention que le reste de l'app,
// PriseEnCharge.date est une chaîne libre, jamais un vrai type Date).
function anneeDe(date: string): string {
  return date.split("/")[2] ?? "—";
}

function parseDate(date: string): number {
  const [j, m, a] = date.split("/").map(Number);
  if (!j || !m || !a) return 0;
  return new Date(a, m - 1, j).getTime();
}

// Mes Dossiers Patients (2026-08) — voir demande utilisateur : "le médecin
// dans son interface doit avoir le dossier médical de chaque patient qu'il
// aurait reçu. Les dossiers doivent être classés par date, par an. Le
// médecin doit pour y accéder par une simple recherche et le consulter."
// Un "dossier" = l'agrégat de toutes les prescriptions (consultations) déjà
// enregistrées par CE médecin pour un patient donné, groupées par année.
export default function MedecinDossiersPatientsView() {
  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  useEffect(() => { getMesPrescriptions().then(setPrescriptions); }, []);

  const dossiers = useMemo<PatientDossier[]>(() => {
    if (!prescriptions) return [];
    const parPatient = new Map<string, PatientDossier>();
    for (const p of prescriptions) {
      const existant = parPatient.get(p.assureId);
      if (existant) {
        existant.nbConsultations += 1;
        existant.prescriptions.push(p);
        if (parseDate(p.date) > parseDate(existant.derniereDate)) existant.derniereDate = p.date;
      } else {
        parPatient.set(p.assureId, {
          assureId: p.assureId, assureNom: p.assureNom, assureMatricule: p.assureMatricule,
          nbConsultations: 1, derniereDate: p.date, prescriptions: [p],
        });
      }
    }
    return [...parPatient.values()].sort((a, b) => parseDate(b.derniereDate) - parseDate(a.derniereDate));
  }, [prescriptions]);

  const dossierOuvert = useMemo(() => dossiers.find((d) => d.assureId === patientId) ?? null, [dossiers, patientId]);

  if (dossierOuvert) {
    // Groupement par année, années les plus récentes en premier — voir
    // demande utilisateur : "classés par date, par an".
    const parAnnee = new Map<string, Prescription[]>();
    for (const p of [...dossierOuvert.prescriptions].sort((a, b) => parseDate(b.date) - parseDate(a.date))) {
      const annee = anneeDe(p.date);
      if (!parAnnee.has(annee)) parAnnee.set(annee, []);
      parAnnee.get(annee)!.push(p);
    }
    const annees = [...parAnnee.keys()].sort((a, b) => Number(b) - Number(a));

    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={() => setPatientId(null)} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à mes dossiers patients
        </button>

        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">{dossierOuvert.assureNom}</p>
            <p className="text-[11.5px] text-muted-foreground">{dossierOuvert.assureMatricule} · {dossierOuvert.nbConsultations} consultation{dossierOuvert.nbConsultations > 1 ? "s" : ""}</p>
          </div>
        </div>

        {annees.map((annee) => (
          <div key={annee} className="space-y-3">
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">{annee}</p>
            {parAnnee.get(annee)!.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-foreground">{p.date} — {p.acteLibelle ?? "Consultation"}</p>
                  <span className="text-[11px] text-muted-foreground">{p.prestataireNom}</span>
                </div>
                {p.motifsConsultation.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.motifsConsultation.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] text-foreground">{m}</span>
                    ))}
                  </div>
                )}
                {p.codeAffection && <p className="text-[11.5px] text-muted-foreground">Code affection : <span className="text-foreground font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>{p.codeAffection}</span></p>}
                {p.lignes.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {p.lignes.map((l) => (
                      <div key={l.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/25 text-[12px]">
                        {l.type === "Medicament" ? <Pill className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <FlaskConical className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        <span className="flex-1 text-foreground">{l.libelle}{l.posologie ? ` — ${l.posologie}` : ""}</span>
                        <Badge variant={l.statut === "Traite" ? "success" : "warning"}>{l.statut === "Traite" ? "Traité" : "En attente"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {(p.numeroFeuilleSoins || p.numeroBonExamen) && (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {p.numeroFeuilleSoins && (
                      <button type="button" onClick={() => ouvrirFeuilleSoinsPrescription(p.id)} className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline">
                        <FileDown className="w-3.5 h-3.5" />Imprimer la feuille de soins
                      </button>
                    )}
                    {p.numeroBonExamen && (
                      <button type="button" onClick={() => ouvrirFeuilleExamenPrescription(p.id)} className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline">
                        <FileDown className="w-3.5 h-3.5" />Imprimer le bon d'examen
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><FolderClock className="w-5 h-5 text-primary" />Mes Dossiers Patients</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Recherchez un patient déjà reçu pour consulter son dossier médical.</p>
      </div>

      <Combobox
        options={dossiers}
        value={null}
        onChange={(d) => d && setPatientId(d.assureId)}
        getLabel={(d) => d.assureNom} getSubLabel={(d) => d.assureMatricule} getId={(d) => d.assureId}
        placeholder="Rechercher un patient (nom, matricule)…"
      />

      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-3 py-2">Patient</th>
              <th className="text-left px-3 py-2">Matricule</th>
              <th className="text-left px-3 py-2">Consultations</th>
              <th className="text-left px-3 py-2">Dernière visite</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {dossiers.map((d) => (
              <tr key={d.assureId} className="hover:bg-secondary/25 cursor-pointer" onClick={() => setPatientId(d.assureId)}>
                <td className="px-3 py-2 font-medium text-foreground">{d.assureNom}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.assureMatricule}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.nbConsultations}</td>
                <td className="px-3 py-2 text-muted-foreground">{d.derniereDate}</td>
                <td className="px-3 py-2 text-right text-primary text-[11.5px]">Ouvrir le dossier →</td>
              </tr>
            ))}
            {prescriptions && dossiers.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Aucun patient reçu pour l'instant.</td></tr>
            )}
            {!prescriptions && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

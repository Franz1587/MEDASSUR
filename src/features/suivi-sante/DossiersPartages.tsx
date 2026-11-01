import { useEffect, useState } from "react";
import { FileText, FolderOpen, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { ajouterMesurePatient, getDossierPatient, getPatientsPartages, ouvrirDocumentPatient, TYPES_MESURE, UNITE_MESURE, type DossierPatient, type PatientPartage } from "@/services/suiviSante.service";
import { carte, champ } from "./commun";

const Liste = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <div className={carte}><p className="text-[13px] font-semibold text-foreground mb-2">{titre}</p>{children}</div>
);
const Vide = () => <p className="text-[12px] text-muted-foreground">Aucun élément.</p>;

// Dossiers que les patients ont ouverts à ce médecin (2026-11) — accès retiré
// dès que le patient le ferme (le serveur refuse alors toute lecture).
export function DossiersPartages() {
  const [patients, setPatients] = useState<PatientPartage[] | null>(null);
  const [ouvert, setOuvert] = useState<PatientPartage | null>(null);
  const [dossier, setDossier] = useState<DossierPatient | null>(null);
  const [mesure, setMesure] = useState({ type: "Tension", valeur: "", note: "" });

  useEffect(() => { getPatientsPartages().then(setPatients).catch(() => setPatients([])); }, []);

  const ouvrir = (p: PatientPartage) => {
    setOuvert(p); setDossier(null);
    getDossierPatient(p.id).then(setDossier).catch((err) => {
      toast.error(err instanceof Error && /403/.test(err.message) ? "Le patient a fermé l'accès à son dossier." : "Dossier indisponible.");
      setOuvert(null);
      getPatientsPartages().then(setPatients).catch(() => undefined);
    });
  };

  const ajouterMesure = async () => {
    if (!ouvert || !mesure.valeur.trim()) return;
    try {
      await ajouterMesurePatient(ouvert.id, { type: mesure.type, valeur: mesure.valeur.trim(), unite: UNITE_MESURE[mesure.type], note: mesure.note.trim() || undefined });
      setMesure({ ...mesure, valeur: "", note: "" });
      setDossier(await getDossierPatient(ouvert.id));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Enregistrement impossible."); }
  };

  if (patients !== null && patients.length === 0 && !ouvert) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-[14px] font-semibold text-foreground inline-flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary" />Dossiers partagés avec vous</h2>
      {patients === null ? <p className="text-[12.5px] text-muted-foreground">Chargement…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {patients.map((p) => (
            <button key={p.id} type="button" onClick={() => ouvrir(p)} className="text-left bg-card border border-border rounded-xl p-3 hover:border-primary/50">
              <p className="text-[13px] font-medium text-foreground">{p.prenom ?? ""} {p.nom}</p>
              <p className="text-[11.5px] text-muted-foreground"><span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{p.matricule}</span> · ouvert le {new Date(p.accesDepuis).toLocaleDateString("fr-FR")}</p>
            </button>
          ))}
        </div>
      )}

      {ouvert && (
        <div role="dialog" aria-modal="true" aria-label={`Dossier de ${ouvert.nom}`} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-background border border-border rounded-xl shadow-2xl max-h-[94vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card">
              <h3 className="text-[15px] font-semibold text-foreground">Dossier médical — {ouvert.prenom ?? ""} {ouvert.nom}</h3>
              <button type="button" onClick={() => setOuvert(null)} aria-label="Fermer" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
            </div>
            {!dossier ? <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
              <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Liste titre="Identité et informations médicales">
                  <p className="text-[12.5px] text-foreground">{dossier.assure.sexe === "F" ? "Femme" : dossier.assure.sexe === "M" ? "Homme" : ""}{dossier.assure.dateNaissance && ` · né(e) le ${dossier.assure.dateNaissance}`}{dossier.assure.groupeSanguin && ` · groupe ${dossier.assure.groupeSanguin}`}</p>
                  {([["Allergies", dossier.assure.allergies], ["Antécédents", dossier.assure.antecedentsMedicaux], ["Traitements en cours", dossier.assure.traitementsEnCours]] as const).map(([l, v]) => (
                    <p key={l} className="text-[12.5px] text-foreground mt-1"><span className="text-muted-foreground">{l} : </span>{v.length ? v.join(", ") : "—"}</p>
                  ))}
                </Liste>
                <Liste titre="Constantes et contrôles">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                    <select value={mesure.type} onChange={(e) => setMesure({ ...mesure, type: e.target.value })} aria-label="Type de mesure" className={champ}>{TYPES_MESURE.map((t) => <option key={t}>{t}</option>)}</select>
                    <input value={mesure.valeur} onChange={(e) => setMesure({ ...mesure, valeur: e.target.value })} placeholder={`Valeur${UNITE_MESURE[mesure.type] ? ` (${UNITE_MESURE[mesure.type]})` : ""}`} aria-label="Valeur" className={champ} />
                    <button type="button" onClick={ajouterMesure} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium">Ajouter</button>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-0.5">
                    {dossier.mesures.length === 0 ? <Vide /> : dossier.mesures.map((m) => (
                      <p key={m.id} className="text-[12px] text-foreground"><span className="text-muted-foreground">{new Date(m.dateMesure).toLocaleDateString("fr-FR")} · {m.type} : </span>{m.valeur} {m.unite ?? ""}{m.note ? ` (${m.note})` : ""}</p>
                    ))}
                  </div>
                </Liste>
                <Liste titre="Ordonnances et bons d'examen">
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {dossier.prescriptions.length === 0 ? <Vide /> : dossier.prescriptions.map((p) => (
                      <div key={p.id} className="text-[12px] border-b border-border/60 pb-1.5">
                        <p className="text-foreground font-medium">{p.date} · {p.prescripteur}{p.origine === "Numérisée" && <span className="text-muted-foreground font-normal"> (bon papier numérisé)</span>}</p>
                        {p.codeAffection && <p className="text-muted-foreground">Affection : {p.codeAffection}</p>}
                        {p.lignes.map((l, i) => <p key={i} className="text-foreground">{l.type === "Examen" ? "Examen" : "Médicament"} : {l.libelle} × {l.quantite}{l.posologie ? ` — ${l.posologie}` : ""}</p>)}
                      </div>
                    ))}
                  </div>
                </Liste>
                <Liste titre="Consultations et soins">
                  <div className="max-h-72 overflow-y-auto space-y-0.5">
                    {dossier.consultations.length === 0 ? <Vide /> : dossier.consultations.map((c) => (
                      <p key={c.id} className="text-[12px] text-foreground"><span className="text-muted-foreground">{c.date} · </span>{c.acte ?? c.type}{c.structure ? ` — ${c.structure}` : ""}{c.codeAffection ? ` · ${c.codeAffection}` : ""}</p>
                    ))}
                  </div>
                </Liste>
                <Liste titre="Documents du carnet de santé">
                  {dossier.documents.length === 0 ? <Vide /> : dossier.documents.map((d) => (
                    <button key={d.id} type="button" onClick={() => ouvrirDocumentPatient(ouvert.id, d.id, d.libelle ?? d.rubrique).catch((e) => toast.error(e.message))} className="w-full text-left text-[12px] text-primary hover:underline inline-flex items-center gap-1.5 py-0.5">
                      <FileText className="w-3.5 h-3.5" />{d.libelle || d.rubrique} · {new Date(d.dateAjout).toLocaleDateString("fr-FR")}
                    </button>
                  ))}
                </Liste>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

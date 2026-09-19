import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Stethoscope, Plus, Trash2, FileDown, Pill, FlaskConical, ArrowLeft, X } from "lucide-react";
import { Combobox } from "@/components/shared/Combobox";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { getActesMedicaux } from "@/services/acteMedical.service";
import type { ActeMedical } from "@/types/acteMedical";
import { getCodesAffection, type CodeAffection } from "@/services/codesAffection.service";
import { MOTIFS_CONSULTATION } from "@/lib/motifsConsultation";
import {
  creerPrescription, getMesPrescriptions, ouvrirFeuilleExamenPrescription, ouvrirFeuilleSoinsPrescription, suggererPosologie,
  type CreatePrescriptionLigneInput, type Prescription,
} from "@/services/portailMedecin.service";
import { GROUPES_ACTES } from "../portail-prestataire/prestationTypes";
import { MEDECIN_HANDOFF_KEY } from "./FileAttente";
import type { PatientEnAttente } from "@/services/portailMedecin.service";

const GROUPES_EXAMEN = new Set(["Analyse", "Imagerie", "ActesSpecialites"]);

function groupeDe(famille: string | undefined): string | undefined {
  return GROUPES_ACTES.find((g) => famille && g.familles.includes(famille))?.cle;
}

interface LigneForm {
  cle: string;
  type: "Medicament" | "Examen";
  acte: ActeMedical;
  quantite: number;
  posologie: string;
}

// Consultation — médecin prescripteur (2026-08) — voir demande utilisateur :
// "un écran dédié au médecin prescripteur... consultation en ligne. il
// doit pouvoir renseigner le dossier clinique du patient, avec motif de
// consultation, code affection, une e-ordonnance avec les quantités et la
// posologie... il doit également pouvoir saisir un bon examen." Le patient
// arrive TOUJOURS depuis la file d'attente (voir demande utilisateur,
// correction : "il n'a pas besoin d'identifier un assuré") — jamais de
// recherche ici, seulement le formulaire de prescription.
export default function MedecinConsultationView() {
  const { setView } = useShellNavigation();
  const [patient, setPatient] = useState<PatientEnAttente | null>(null);

  const [codesAffection, setCodesAffection] = useState<CodeAffection[]>([]);
  const [codeAffection, setCodeAffection] = useState<CodeAffection | null>(null);
  // Motifs de consultation (2026-08) — voir demande utilisateur :
  // "l'application doit pouvoir faire remonter une liste des motifs, avec
  // la possibilité d'en ajouter plusieurs" — même patron "chercher/ajouter,
  // liste de chips retirables" que les sections médicaments/examens
  // ci-dessous, plus un champ personnalisé pour un motif absent de la liste.
  const [motifs, setMotifs] = useState<string[]>([]);
  const [motifPersonnalise, setMotifPersonnalise] = useState("");

  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [lignes, setLignes] = useState<LigneForm[]>([]);
  // Suggestion de posologie par IA (2026-08) — voir demande utilisateur :
  // "l'application grâce à l'IA doit connaître la logique de posologie d'un
  // produit en fonction de l'âge et du sexe du patient... si le médecin veut
  // faire un ajustement il pourra retoucher, mais au moins il gagnera en
  // temps" — simple pré-remplissage asynchrone, jamais bloquant.
  const [posologieEnCours, setPosologieEnCours] = useState<Set<string>>(new Set());
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<Prescription | null>(null);
  // Garde-fou anti-double-soumission (2026-08) — `disabled={envoi}` seul ne
  // suffit pas : un double-clic rapide peut partir avant le re-render qui
  // désactive le bouton, provoquant un second POST qui échoue avec "cette
  // consultation a déjà une prescription" (constaté par l'utilisateur). Un
  // ref se met à jour de façon synchrone, contrairement à un state.
  const soumissionEnCours = useRef(false);

  useEffect(() => {
    const brut = sessionStorage.getItem(MEDECIN_HANDOFF_KEY);
    if (brut) { setPatient(JSON.parse(brut)); sessionStorage.removeItem(MEDECIN_HANDOFF_KEY); }
    getActesMedicaux().then(setActes);
    getCodesAffection().then(setCodesAffection);
  }, []);

  const actesMedicament = useMemo(() => actes.filter((a) => a.famille === "PHARMACIE"), [actes]);
  const actesExamen = useMemo(() => actes.filter((a) => GROUPES_EXAMEN.has(groupeDe(a.famille) ?? "")), [actes]);
  const motifsDisponibles = useMemo(() => MOTIFS_CONSULTATION.filter((m) => !motifs.includes(m)), [motifs]);

  const ajouterMotif = (motif: string) => {
    const m = motif.trim();
    if (!m) return;
    if (motifs.includes(m)) { toast.error("Ce motif est déjà ajouté."); return; }
    setMotifs((v) => [...v, m]);
  };
  const retirerMotif = (m: string) => setMotifs((v) => v.filter((x) => x !== m));

  const ajouterLigne = (acte: ActeMedical | null, type: "Medicament" | "Examen") => {
    if (!acte) return;
    if (lignes.some((l) => l.acte.id === acte.id)) { toast.error("Cet acte est déjà ajouté."); return; }
    setLignes((v) => [...v, { cle: acte.id, type, acte, quantite: 1, posologie: "" }]);

    if (type === "Medicament" && patient) {
      setPosologieEnCours((v) => new Set(v).add(acte.id));
      suggererPosologie(acte.libelle, patient.assureId)
        .then((posologie) => {
          if (!posologie) return;
          // Ne jamais écraser une posologie déjà saisie/retouchée par le
          // médecin entre-temps — simple pré-remplissage, pas une valeur
          // imposée (voir demande utilisateur : "il pourra retoucher").
          setLignes((v) => v.map((l) => (l.cle === acte.id && !l.posologie.trim() ? { ...l, posologie } : l)));
        })
        .catch(() => {})
        .finally(() => setPosologieEnCours((v) => { const s = new Set(v); s.delete(acte.id); return s; }));
    }
  };
  const retirerLigne = (cle: string) => setLignes((v) => v.filter((l) => l.cle !== cle));
  const majLigne = (cle: string, patch: Partial<LigneForm>) => setLignes((v) => v.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));

  const soumettre = async () => {
    if (!patient || soumissionEnCours.current) return;
    if (motifs.length === 0) { toast.error("Ajoutez au moins un motif de consultation."); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins un médicament ou un examen."); return; }
    soumissionEnCours.current = true;
    setEnvoi(true);
    try {
      const payloadLignes: CreatePrescriptionLigneInput[] = lignes.map((l) => ({
        type: l.type, acteMedicalId: l.acte.id, libelle: l.acte.libelle, quantite: l.quantite,
        posologie: l.type === "Medicament" ? (l.posologie.trim() || undefined) : undefined,
      }));
      const cree = await creerPrescription({
        priseEnChargeId: patient.id, motifsConsultation: motifs,
        codeAffection: codeAffection?.code, lignes: payloadLignes,
      });
      toast.success("Prescription enregistrée.");
      setResultat(cree);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      // Récupération (2026-08) — si un double-clic (ou une nouvelle
      // tentative après un aléa réseau) a déjà créé la prescription, ne pas
      // laisser le médecin bloqué sur un formulaire qui ne peut plus
      // aboutir : on retrouve l'ordonnance déjà enregistrée et on l'affiche
      // normalement, comme si la soumission avait réussi.
      if (message.includes("a déjà une prescription")) {
        const mesPrescriptions = await getMesPrescriptions().catch(() => []);
        const existante = mesPrescriptions.find((p) => p.priseEnChargeId === patient.id);
        if (existante) {
          toast.info("Cette consultation avait déjà été enregistrée — voici la prescription existante.");
          setResultat(existante);
          return;
        }
      }
      toast.error(message || "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
      soumissionEnCours.current = false;
    }
  };

  const retourFileAttente = () => setView("medecinFileAttente");

  if (!patient && !resultat) {
    return (
      <div className="p-6">
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <Stethoscope className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground mb-3">Sélectionnez d'abord un patient depuis la file d'attente.</p>
          <button type="button" onClick={retourFileAttente} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium">Aller à la file d'attente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <button type="button" onClick={retourFileAttente} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" />Retour à la file d'attente
      </button>

      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" />Consultation</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Dossier clinique, e-ordonnance et bon d'examen.</p>
      </div>

      {resultat ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-[13px] font-semibold text-foreground">Prescription enregistrée pour {resultat.assureNom}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resultat.numeroFeuilleSoins && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Pill className="w-3.5 h-3.5" />Ordonnance — Feuille de Soins</p>
                <p className="text-[13px] font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{resultat.numeroFeuilleSoins}</p>
                <button type="button" onClick={() => ouvrirFeuilleSoinsPrescription(resultat.id)} className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline">
                  <FileDown className="w-3.5 h-3.5" />Imprimer la feuille de soins
                </button>
              </div>
            )}
            {resultat.numeroBonExamen && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" />Bon d'examen</p>
                <p className="text-[13px] font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{resultat.numeroBonExamen}</p>
                <button type="button" onClick={() => ouvrirFeuilleExamenPrescription(resultat.id)} className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline">
                  <FileDown className="w-3.5 h-3.5" />Imprimer le bon d'examen
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={retourFileAttente} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Retour à la file d'attente</button>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-[13px] font-semibold text-foreground">{patient!.assureNom} — {patient!.assureMatricule}</p>
            <p className="text-[11.5px] text-muted-foreground">{patient!.acteLibelle ?? patient!.type} · {patient!.date} · {patient!.prestataireNom}</p>

            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Motifs de consultation *</div>
              <Combobox
                options={motifsDisponibles}
                value={null}
                onChange={(m) => m && ajouterMotif(m)}
                getLabel={(m) => m} getId={(m) => m}
                placeholder="Rechercher un motif…"
              />
              <div className="flex gap-2 mt-2">
                <input
                  value={motifPersonnalise} onChange={(e) => setMotifPersonnalise(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterMotif(motifPersonnalise); setMotifPersonnalise(""); } }}
                  placeholder="Ou saisir un motif personnalisé…"
                  className="flex-1 h-8 px-2.5 rounded-md border border-border bg-background text-[12px] text-foreground"
                />
                <button
                  type="button" onClick={() => { ajouterMotif(motifPersonnalise); setMotifPersonnalise(""); }}
                  className="h-8 px-3 rounded-md border border-border text-[12px] text-foreground hover:bg-secondary/40 flex-shrink-0"
                >
                  Ajouter
                </button>
              </div>
              {motifs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {motifs.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 border border-primary/25 text-[12px] text-foreground">
                      {m}
                      <button type="button" onClick={() => retirerMotif(m)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </label>
            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Code affection (CNAMGS)</div>
              <Combobox
                options={codesAffection}
                value={codeAffection}
                onChange={setCodeAffection}
                getLabel={(c) => `${c.code} — ${c.libelle}`} getSubLabel={(c) => c.chapitre} getId={(c) => c.code}
                allowClear clearLabel="Non renseigné"
                placeholder="Rechercher un code affection…"
              />
            </label>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5"><Pill className="w-4 h-4 text-primary" />E-ordonnance (médicaments)</p>
            <Combobox
              options={actesMedicament}
              value={null}
              onChange={(a) => ajouterLigne(a, "Medicament")}
              getLabel={(a) => a.libelle} getId={(a) => a.id}
              placeholder="Rechercher un médicament à prescrire…"
            />
            {lignes.filter((l) => l.type === "Medicament").map((l) => (
              <div key={l.cle} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/25">
                <span className="flex-1 min-w-0 text-[12.5px] text-foreground truncate">{l.acte.libelle}</span>
                <input
                  value={l.posologie} onChange={(e) => majLigne(l.cle, { posologie: e.target.value })}
                  placeholder={posologieEnCours.has(l.cle) ? "Suggestion IA en cours…" : "Posologie (ex. 1 cp matin et soir, 7 jours)"}
                  className="flex-[2] h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground placeholder:italic"
                />
                <input
                  type="number" min={1} value={l.quantite} onChange={(e) => majLigne(l.cle, { quantite: Math.max(1, Number(e.target.value)) })}
                  className="w-16 h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground text-right"
                />
                <button type="button" onClick={() => retirerLigne(l.cle)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-primary" />Bon d'examen</p>
            <Combobox
              options={actesExamen}
              value={null}
              onChange={(a) => ajouterLigne(a, "Examen")}
              getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
              placeholder="Rechercher un examen à prescrire…"
            />
            {lignes.filter((l) => l.type === "Examen").map((l) => (
              <div key={l.cle} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/25">
                <span className="flex-1 min-w-0 text-[12.5px] text-foreground truncate">{l.acte.libelle}</span>
                <input
                  type="number" min={1} value={l.quantite} onChange={(e) => majLigne(l.cle, { quantite: Math.max(1, Number(e.target.value)) })}
                  className="w-16 h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground text-right"
                />
                <button type="button" onClick={() => retirerLigne(l.cle)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <button type="button" onClick={soumettre} disabled={envoi} className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
            <Plus className="w-4 h-4" />{envoi ? "Enregistrement…" : "Enregistrer la prescription"}
          </button>
        </>
      )}
    </div>
  );
}

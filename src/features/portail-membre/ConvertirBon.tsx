import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { getReseauSoins, type PrestataireReseau } from "@/services/reseauSoins.service";
import { convertirBonPapier, getProfessionnels, lireBonPapier, nomMedecin, type LigneLue, type Professionnel } from "@/services/suiviSante.service";

type Ligne = Omit<LigneLue, "acteLibelle"> & { acteLibelle?: string | null };
const champ = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground";

// Rapproche un nom lu sur le papier d'une entrée de la base (sans casse ni accents).
const sansAccent = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function rapprocher<T>(texte: string, options: T[], nom: (o: T) => string): T | null {
  const t = sansAccent(texte);
  if (t.length < 3) return null;
  return options.find((o) => sansAccent(nom(o)) === t) ?? options.find((o) => { const n = sansAccent(nom(o)); return n.length >= 4 && (t.includes(n) || n.includes(t)); }) ?? null;
}

// Ordonnance / bon d'examen papier → électronique (2026-11). ARIANA propose,
// l'assuré relit et corrige ; sans lecture possible, saisie manuelle.
export function ConvertirBon({ documentId, assureId, onFermer, onConverti }: { documentId: string; assureId: string; onFermer: () => void; onConverti: () => void }) {
  const [lecture, setLecture] = useState<"cours" | "ok" | "echec">("cours");
  const [remarque, setRemarque] = useState("");
  const [beneficiaire, setBeneficiaire] = useState(assureId);
  const [entete, setEntete] = useState({ prescripteur: "", titrePrescripteur: "", codePraticien: "", structure: "", codeEtablissement: "", date: "", codeAffection: "" });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [cachet, setCachet] = useState<{ visible: boolean; x: number; y: number; w: number; h: number } | null>(null);
  // Établissement et prescripteur pris dans la base quand ils y sont,
  // saisie libre sinon (structure hors réseau, médecin non enregistré).
  const [structures, setStructures] = useState<PrestataireReseau[]>([]);
  const [medecins, setMedecins] = useState<Professionnel[]>([]);
  const [structure, setStructure] = useState<PrestataireReseau | null>(null);
  const [medecin, setMedecin] = useState<Professionnel | null>(null);

  useEffect(() => {
    getReseauSoins().then(setStructures).catch(() => undefined);
    getProfessionnels().then(setMedecins).catch(() => undefined);
  }, []);
  // Rapprochement automatique de ce qu'ARIANA a lu avec la base.
  useEffect(() => {
    if (lecture !== "ok") return;
    if (!structure && structures.length) setStructure(rapprocher(entete.structure, structures, (s) => s.nom));
    if (!medecin && medecins.length) setMedecin(rapprocher(entete.prescripteur, medecins, (m) => `${m.prenom ?? ""} ${m.nom}`) ?? rapprocher(entete.prescripteur, medecins, (m) => m.nom));
  }, [lecture, structures, medecins]); // eslint-disable-line react-hooks/exhaustive-deps
  const medecinsProposes = structure ? medecins.filter((m) => m.structures.some((s) => s.id === structure.id)) : medecins;

  useEffect(() => {
    lireBonPapier(documentId)
      .then((l) => {
        setBeneficiaire(l.assureId);
        setEntete({ prescripteur: l.prescripteur, titrePrescripteur: l.titrePrescripteur, codePraticien: l.codePraticien, structure: l.structure, codeEtablissement: l.codeEtablissement, date: l.date, codeAffection: l.codeAffection });
        setLignes(l.lignes);
        if (l.cachetVisible && l.cachetW && l.cachetH) setCachet({ visible: true, x: l.cachetX ?? 0, y: l.cachetY ?? 0, w: l.cachetW, h: l.cachetH });
        setRemarque([!l.lisible && "Document peu lisible : vérifiez chaque ligne.", l.typeDocument === "Autre" && "Ce document ne ressemble pas à une prescription.", l.remarques].filter(Boolean).join(" "));
        setLecture("ok");
      })
      .catch((err) => {
        setRemarque(err instanceof Error ? err.message.replace(/^.*"message":"([^"]+)".*$/, "$1") : "Lecture impossible.");
        setLignes([{ type: "Medicament", libelle: "", quantite: 1, posologie: "", acteMedicalId: null }]);
        setLecture("echec");
      });
  }, [documentId]);

  const maj = (i: number, p: Partial<Ligne>) => setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...p, ...(p.libelle !== undefined ? { acteMedicalId: null, acteLibelle: null } : {}) } : x)));

  const valider = async () => {
    const retenues = lignes.filter((l) => l.libelle.trim());
    if (!retenues.length) { toast.error("Ajoutez au moins un médicament ou un examen."); return; }
    setEnvoi(true);
    try {
      const r = await convertirBonPapier(documentId, {
        assureId: beneficiaire,
        prescripteurNom: medecin ? nomMedecin(medecin) : entete.prescripteur,
        titrePrescripteur: entete.titrePrescripteur || undefined,
        codePraticien: entete.codePraticien || undefined,
        structureNom: structure?.nom ?? entete.structure,
        codeEtablissement: entete.codeEtablissement || undefined,
        dateOrdonnance: entete.date, codeAffection: entete.codeAffection || undefined,
        ...(cachet ? { cachetVisible: true, cachetX: cachet.x, cachetY: cachet.y, cachetW: cachet.w, cachetH: cachet.h } : {}),
        lignes: retenues.map((l) => ({ type: l.type, libelle: l.libelle, quantite: l.quantite, posologie: l.posologie || undefined, acteMedicalId: l.acteMedicalId ?? undefined })),
      });
      toast.success(`Bon électronique créé : ${[r.numeroOrdonnance && `ordonnance ${r.numeroOrdonnance}`, r.numeroBonExamen && `bon d'examen ${r.numeroBonExamen}`].filter(Boolean).join(" et ")}. La référence vous est aussi envoyée par SMS.`);
      onConverti();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="conv-titre" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h3 id="conv-titre" className="text-[15px] font-semibold text-foreground inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Convertir en ordonnance / bon électronique</h3>
            <p className="text-[12px] text-muted-foreground">Vérifiez les lignes lues par ARIANA : le bon électronique pourra être délivré par toute pharmacie ou tout laboratoire du réseau.</p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          {lecture === "cours" ? (
            <div className="py-12 flex flex-col items-center gap-3 text-[13px] text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin text-primary" />ARIANA lit votre document…</div>
          ) : (
            <>
              {remarque && <p className={`text-[12px] rounded-lg px-3 py-2 border ${lecture === "echec" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border bg-secondary/30 text-foreground"}`}>{lecture === "echec" ? `${remarque} Saisissez les lignes à la main.` : `⚠ ${remarque}`}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><span className="text-[11.5px] text-muted-foreground">Établissement</span>
                  <Combobox options={structures} value={structure} onChange={(s) => { setStructure(s); if (s && medecin && !medecin.structures.some((x) => x.id === s.id)) setMedecin(null); }}
                    getLabel={(s) => s.nom} getSubLabel={(s) => [s.type, s.ville].filter(Boolean).join(" · ")} getId={(s) => s.id}
                    texteLibre={entete.structure} onTexteLibre={(t) => setEntete({ ...entete, structure: t })} placeholder="Rechercher ou saisir l'établissement" />
                </div>
                <div><span className="text-[11.5px] text-muted-foreground">Prescripteur</span>
                  <Combobox options={medecinsProposes} value={medecin} onChange={setMedecin}
                    getLabel={nomMedecin} getSubLabel={(m) => m.specialite ?? "Médecine générale"} getId={(m) => m.id}
                    texteLibre={entete.prescripteur} onTexteLibre={(t) => setEntete({ ...entete, prescripteur: t })} placeholder="Rechercher ou saisir le médecin" />
                </div>
                <div><span className="text-[11.5px] text-muted-foreground">Date de l'ordonnance</span>
                  <DateInput value={entete.date} onChange={(d) => setEntete({ ...entete, date: d })} className={champ} />
                </div>
              </div>
              <div className="space-y-2">
                {lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr_70px_32px] sm:grid-cols-[120px_1fr_80px_1fr_32px] gap-2 items-start">
                    <select value={l.type} onChange={(e) => maj(i, { type: e.target.value as Ligne["type"] })} aria-label="Type" className={champ}>
                      <option value="Medicament">Médicament</option><option value="Examen">Examen</option>
                    </select>
                    <div>
                      <input value={l.libelle} onChange={(e) => maj(i, { libelle: e.target.value })} placeholder="Libellé" aria-label="Libellé" className={champ} />
                      {l.acteLibelle && <p className="text-[11px] text-muted-foreground mt-0.5">Catalogue : {l.acteLibelle}</p>}
                    </div>
                    <input type="number" min={1} value={l.quantite} onChange={(e) => maj(i, { quantite: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantité" className={champ} />
                    <input value={l.posologie} onChange={(e) => maj(i, { posologie: e.target.value })} placeholder="Posologie" aria-label="Posologie" className={`${champ} col-span-3 sm:col-span-1`} />
                    <button type="button" onClick={() => setLignes((x) => x.filter((_, k) => k !== i))} aria-label="Retirer la ligne" className="h-9 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-destructive row-start-1 col-start-4 sm:col-start-5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setLignes((x) => [...x, { type: "Medicament", libelle: "", quantite: 1, posologie: "", acteMedicalId: null }])} className="h-9 px-3 rounded-lg border border-dashed border-border text-[12.5px] text-foreground inline-flex items-center gap-2 hover:bg-secondary/40"><Plus className="w-4 h-4" />Ajouter une ligne</button>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="h-10 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <button type="button" onClick={valider} disabled={lecture === "cours" || envoi} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}Créer le bon électronique
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { convertirBonPapier, lireBonPapier, type LigneLue } from "@/services/suiviSante.service";

type Ligne = Omit<LigneLue, "acteLibelle"> & { acteLibelle?: string | null };
const champ = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground";

// Ordonnance / bon d'examen papier → électronique (2026-11). ARIANA propose,
// l'assuré relit et corrige ; sans lecture possible, saisie manuelle.
export function ConvertirBon({ documentId, assureId, onFermer, onConverti }: { documentId: string; assureId: string; onFermer: () => void; onConverti: () => void }) {
  const [lecture, setLecture] = useState<"cours" | "ok" | "echec">("cours");
  const [remarque, setRemarque] = useState("");
  const [beneficiaire, setBeneficiaire] = useState(assureId);
  const [entete, setEntete] = useState({ prescripteur: "", structure: "", date: "" });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    lireBonPapier(documentId)
      .then((l) => {
        setBeneficiaire(l.assureId);
        setEntete({ prescripteur: l.prescripteur, structure: l.structure, date: l.date });
        setLignes(l.lignes);
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
        assureId: beneficiaire, prescripteurNom: entete.prescripteur, structureNom: entete.structure, dateOrdonnance: entete.date,
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
                <label className="block"><span className="text-[11.5px] text-muted-foreground">Prescripteur</span><input value={entete.prescripteur} onChange={(e) => setEntete({ ...entete, prescripteur: e.target.value })} className={champ} /></label>
                <label className="block"><span className="text-[11.5px] text-muted-foreground">Établissement</span><input value={entete.structure} onChange={(e) => setEntete({ ...entete, structure: e.target.value })} className={champ} /></label>
                <label className="block"><span className="text-[11.5px] text-muted-foreground">Date (JJ/MM/AAAA)</span><input value={entete.date} onChange={(e) => setEntete({ ...entete, date: e.target.value })} className={champ} /></label>
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

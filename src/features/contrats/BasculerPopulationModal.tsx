import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { getAssuresSante } from "@/services/sante.service";
import { basculerPopulation } from "@/services/contrats.service";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function todayFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface Props {
  contrat: Contrat;
  contrats: Contrat[];
  onClose: () => void;
  onDone: () => void;
}

// Bascule TOUTE (ou une partie) de la population d'un contrat vers un
// autre en une seule opération — cas typique : un contrat résilié dont la
// population (jamais radiée automatiquement, voir
// AvenantsService.appliquer/"Résiliation") est reprise des années plus
// tard par un nouveau contrat, même souscripteur ou un autre. Aucune
// fiche n'est recréée (voir MouvementsService.basculerPopulationVersContrat) —
// les familles sélectionnées partiellement sont complétées côté serveur.
export default function BasculerPopulationModal({ contrat, contrats, onClose, onDone }: Props) {
  const [population, setPopulation] = useState<AssureSante[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [contratDestinationId, setContratDestinationId] = useState("");
  const [dateEffet, setDateEffet] = useState(todayFr());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssuresSante()
      .then((all) => {
        const pop = all.filter((a) => a.police === contrat.id);
        setPopulation(pop);
        setSelected(pop.map((a) => a.id));
      })
      .finally(() => setLoading(false));
  }, [contrat.id]);

  const toutSelectionne = population.length > 0 && population.every((a) => selected.includes(a.id));
  const toggleTout = () => setSelected(toutSelectionne ? [] : population.map((a) => a.id));
  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleSubmit = async () => {
    if (!contratDestinationId) {
      setError("Sélectionnez le contrat destination.");
      return;
    }
    if (selected.length === 0) {
      setError("Sélectionnez au moins une personne à basculer.");
      return;
    }
    if (!dateEffet.trim()) {
      setError("La date d'effet est obligatoire.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const { basculees } = await basculerPopulation(contrat.id, { contratDestinationId, assureIds: selected, dateEffet });
      toast.success(`${basculees.length} personne(s) basculée(s) vers ${contratDestinationId} — fiches conservées, aucune recréation.`);
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la bascule.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary" />Basculer la population — {contrat.id}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{contrat.client} · {population.length} personne(s) sur ce contrat</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <p className="text-[12px] text-muted-foreground">
            Fait passer les personnes cochées ci-dessous vers un autre contrat sans les recréer — utile pour reprendre, des années plus tard, la population d'un contrat résilié (même souscripteur ou un autre). Génère un avenant Retrait sur ce contrat et un avenant Incorporation sur le contrat destination ; toute personne radiée redevient active.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className={labelCls}>Contrat destination</div>
              <Combobox
                options={contrats.filter((c) => c.id !== contrat.id)}
                value={contrats.find((c) => c.id === contratDestinationId) ?? null}
                onChange={(c) => setContratDestinationId(c?.id ?? "")}
                getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
                placeholder="Rechercher…"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Date d'effet</div>
              <DateInput value={dateEffet} onChange={setDateEffet} className={fieldCls} />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Population à basculer</div>
              {population.length > 0 && (
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} className="w-3.5 h-3.5 accent-primary" />
                  Tout sélectionner
                </label>
              )}
            </div>
            {loading ? (
              <p className="text-[12px] text-muted-foreground py-4">Chargement…</p>
            ) : population.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucun assuré rattaché à ce contrat.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto divide-y divide-border/50">
                {population.map((a) => (
                  <label key={a.id} className="flex items-center justify-between px-3 py-2 text-[12px] cursor-pointer hover:bg-secondary/30">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="w-3.5 h-3.5 accent-primary" />
                      <span className="text-foreground">{a.nom} {a.prenom ?? ""} <span className="text-muted-foreground">({a.typeAssure ?? "—"})</span></span>
                    </span>
                    {a.statut === "Radié" && <span className="text-[10.5px] text-destructive">Radié — sera réactivé</span>}
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5">{selected.length} personne(s) sélectionnée(s) — une famille sélectionnée partiellement est complétée automatiquement à l'enregistrement.</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <div className="text-[12px] text-destructive">{error ?? ""}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
            <button type="button" disabled={submitting} onClick={handleSubmit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">
              {submitting ? "Bascule en cours…" : "Basculer la population"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getAssuresSante } from "@/services/sante.service";
import { genererComptesMobile, type CanalEnvoiAcces, type ResultatGenerationCompte } from "@/services/comptesMobile.service";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

interface Props {
  contrat: Contrat;
  onClose: () => void;
}

// Génération réelle des accès mobile (2026-08) — matricule + mot de passe
// temporaire (haché, à réinitialiser à la première connexion), réservée aux
// assurés PRINCIPAUX actifs. Envoi réel par SMS/WhatsApp (2026-09, voir
// ComptesMobileService.generer) quand le numéro est valide et le
// fournisseur (Zavu) configuré — sinon repli sur un message affiché/copiable
// pour un relais manuel (voir statutEnvoi par résultat, ci-dessous).
export default function GenerationComptesMobileModal({ contrat, onClose }: Props) {
  const [population, setPopulation] = useState<AssureSante[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [canal, setCanal] = useState<CanalEnvoiAcces>("WhatsApp+SMS");
  const [submitting, setSubmitting] = useState(false);
  const [resultats, setResultats] = useState<ResultatGenerationCompte[] | null>(null);
  const [copieId, setCopieId] = useState<string | null>(null);

  useEffect(() => {
    getAssuresSante()
      .then((all) => {
        const principaux = all.filter((a) => a.police === contrat.id && a.statut === "Actif" && (a.typeAssure ?? "").toUpperCase() === "AS");
        setPopulation(principaux);
        setSelected(principaux.map((a) => a.id));
      })
      .finally(() => setLoading(false));
  }, [contrat.id]);

  const toutSelectionne = population.length > 0 && population.every((a) => selected.includes(a.id));
  const toggleTout = () => setSelected(toutSelectionne ? [] : population.map((a) => a.id));
  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const generer = async () => {
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un assuré principal.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await genererComptesMobile({ contratId: contrat.id, assureIds: selected, canal });
      setResultats(res);
      toast.success(`${res.length} accès généré(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de génération des accès.");
    } finally {
      setSubmitting(false);
    }
  };

  const copier = async (r: ResultatGenerationCompte) => {
    await navigator.clipboard.writeText(r.messageSimule);
    setCopieId(r.assureId);
    setTimeout(() => setCopieId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Smartphone className="w-4 h-4 text-primary" />Comptes mobile — {contrat.id}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">{contrat.client}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground">
              Les accès sont envoyés directement par SMS/WhatsApp au numéro enregistré. Si un envoi échoue (numéro absent ou invalide), le message reste affiché ci-dessous pour un relais manuel (bouton Copier).
            </p>
          </div>

          {!resultats ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Assurés principaux actifs ({population.length})</div>
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
                <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucun assuré principal actif sur ce contrat.</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto divide-y divide-border/50">
                  {population.map((a) => (
                    <label key={a.id} className="flex items-center justify-between px-3 py-2 text-[12px] cursor-pointer hover:bg-secondary/30">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="w-3.5 h-3.5 accent-primary" />
                        <span className="text-foreground">{a.nom} {a.prenom ?? ""}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground med-num">{a.matricule} · {a.telephone ?? "sans téléphone"}</span>
                    </label>
                  ))}
                </div>
              )}

              <label className="block max-w-xs">
                <div className={labelCls}>Canal d'envoi</div>
                <select value={canal} onChange={(e) => setCanal(e.target.value as CanalEnvoiAcces)} className={fieldCls}>
                  <option value="WhatsApp+SMS">WhatsApp + SMS</option>
                  <option value="WhatsApp">WhatsApp uniquement</option>
                  <option value="SMS">SMS uniquement</option>
                </select>
              </label>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{resultats.length} accès généré(s)</div>
                <button type="button" onClick={() => setResultats(null)} className="text-[11px] text-primary hover:underline">Générer pour d'autres personnes</button>
              </div>
              <div className="space-y-2">
                {resultats.map((r) => (
                  <div key={r.assureId} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-foreground">{r.nom} <span className="text-muted-foreground font-normal med-num">{r.matricule}</span></span>
                      {r.statutEnvoi === "Envoyé" ? (
                        <span className="text-[10.5px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">Envoyé</span>
                      ) : (
                        <span className="text-[10.5px] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">{r.statutEnvoi}</span>
                      )}
                    </div>
                    <pre className="text-[11.5px] text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-2.5 font-sans">{r.messageSimule}</pre>
                    <button type="button" onClick={() => copier(r)} className="mt-1.5 text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                      {copieId === r.assureId ? <><Check className="w-3 h-3" />Copié</> : <><Copy className="w-3 h-3" />Copier le message</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!resultats && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-end flex-shrink-0">
            <button
              type="button"
              disabled={submitting || selected.length === 0}
              onClick={generer}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Génération…" : `Générer les accès mobile (${selected.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

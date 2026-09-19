import { useEffect, useMemo, useState } from "react";
import { Search, X, Banknote, Landmark, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { getPrestataires } from "@/services/prestataires.service";
import { getCompagnies } from "@/services/compagnies.service";
import { getBanques } from "@/services/banques.service";
import { getBordereauxEligiblesLettreCheque, genererLettreCheque } from "@/services/reglementComptable.service";
import type { Prestataire } from "@/types/prestataires";
import type { Compagnie } from "@/types/compagnies";
import type { Banque } from "@/types/banques";
import type { BordereauEligibleLettreCheque } from "@/types/reglementComptable";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Seuil d'alerte sur le nombre de chèques restants — vert au-dessus, rouge
// à partir de 10 restants ou moins (même seuil que GestionBanquesModal).
const SEUIL_ALERTE_RESTANTS = 10;
function couleurRestants(restants: number): string {
  return restants <= SEUIL_ALERTE_RESTANTS ? "text-red-500" : "text-green-500";
}

export default function GenererLettreChequeModal({ onClose, onGenerated, onGererBanques }: {
  onClose: () => void; onGenerated: () => void; onGererBanques: () => void;
}) {
  const [banques, setBanques] = useState<Banque[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);

  const [banqueId, setBanqueId] = useState("");
  const [prestataireId, setPrestataireId] = useState("");
  const [compagnieId, setCompagnieId] = useState("");

  const [resultats, setResultats] = useState<BordereauEligibleLettreCheque[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getBanques().then(setBanques);
    getPrestataires().then(setPrestataires);
    getCompagnies().then(setCompagnies);
  }, []);

  // Changer un critère invalide les résultats déjà affichés — même
  // principe que GenererReglementModal / l'historique de règlement, pour
  // ne jamais générer sur une sélection qui ne correspond plus au filtre
  // courant.
  useEffect(() => { setResultats(null); setSelected([]); }, [banqueId, prestataireId, compagnieId]);

  const banque = banques.find((b) => b.id === banqueId);
  const lotActif = banque?.lots.find((l) => l.statut === "Actif");

  const handleRechercher = async () => {
    if (!banqueId) { toast.error("Choisissez une banque."); return; }
    if (!prestataireId) { toast.error("Choisissez un prestataire."); return; }
    if (!lotActif) { toast.error("Cette banque n'a plus de série de chèques active. Ajoutez-en une nouvelle."); return; }
    setSearching(true);
    try {
      const data = await getBordereauxEligiblesLettreCheque({ prestataireId, compagnieId: compagnieId || undefined });
      setResultats(data);
      setSelected(data.map((b) => b.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setSearching(false);
    }
  };

  const toutSelectionne = resultats !== null && resultats.length > 0 && resultats.every((b) => selected.includes(b.id));
  const toggleTout = () => setSelected(toutSelectionne ? [] : (resultats ?? []).map((b) => b.id));
  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const totalSelectionne = useMemo(
    () => (resultats ?? []).filter((b) => selected.includes(b.id)).reduce((s, b) => s + b.montantNet, 0),
    [resultats, selected],
  );

  const handleGenerer = async () => {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      await genererLettreCheque({ banqueId, prestataireId, compagnieId: compagnieId || undefined, bordereauIds: selected });
      toast.success("Lettre chèque générée.");
      onGenerated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Banknote className="w-4 h-4 text-primary" />Générer un règlement comptable (lettre chèque)</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <div className={labelCls}>Banque *</div>
              <Combobox
                options={banques}
                value={banques.find((b) => b.id === banqueId) ?? null}
                onChange={(b) => setBanqueId(b?.id ?? "")}
                getLabel={(b) => b.nom} getId={(b) => b.id}
                placeholder="Rechercher…"
              />
              {banque && !lotActif && (
                <p className="text-[11px] text-destructive mt-1">Aucune série de chèques active — <button type="button" onClick={onGererBanques} className="underline">en ajouter une</button>.</p>
              )}
              {lotActif && (() => {
                const restants = lotActif.numeroFin - lotActif.numeroProchain + 1;
                return (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Prochain N° : <span className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{lotActif.numeroProchain}</span>
                    {" "}(série {lotActif.numeroDebut}–{lotActif.numeroFin}) — <span className={`font-semibold ${couleurRestants(restants)}`}>{restants}</span> chèque{restants > 1 ? "s" : ""} restant{restants > 1 ? "s" : ""}
                  </p>
                );
              })()}
            </label>
            <label className="block">
              <div className={labelCls}>Prestataire *</div>
              <Combobox
                options={prestataires}
                value={prestataires.find((p) => p.id === prestataireId) ?? null}
                onChange={(p) => setPrestataireId(p?.id ?? "")}
                getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                placeholder="Rechercher…"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Compagnie</div>
              <Combobox
                options={compagnies}
                value={compagnies.find((c) => c.id === compagnieId) ?? null}
                onChange={(c) => setCompagnieId(c?.id ?? "")}
                getLabel={(c) => c.nom} getId={(c) => c.id}
                allowClear clearLabel="Toutes"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Btn variant="primary" onClick={handleRechercher} disabled={searching}><Search className="w-4 h-4" />{searching ? "Recherche…" : "Rechercher"}</Btn>
            <Btn variant="ghost" onClick={onGererBanques}><Landmark className="w-4 h-4" />Gérer les banques</Btn>
          </div>

          {resultats !== null && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/20 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} disabled={resultats.length === 0} className="w-3.5 h-3.5 accent-primary" />
                  Tout sélectionner ({resultats.length} règlement{resultats.length > 1 ? "s" : ""} validé{resultats.length > 1 ? "s" : ""})
                </label>
                <span className="text-[11px] text-muted-foreground">{selected.length} sélectionné{selected.length > 1 ? "s" : ""} — {fmtM(totalSelectionne)} FCFA net à payer</span>
              </div>
              {resultats.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm px-6">
                  Aucun règlement validé en attente de paiement pour ces critères.
                  <br />Un règlement doit d'abord passer au statut <span className="font-semibold text-foreground">« Validé »</span> (bouton <CheckCircle className="w-3.5 h-3.5 inline-block text-green-500 -mt-0.5" /> dans la table « Règlements établis » de l'écran Règlement) avant d'apparaître ici — les règlements « Reçu » ne sont pas encore éligibles.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                  {resultats.map((b) => (
                    <label key={b.id} className="flex items-center gap-3 px-3 py-2 text-[12px] cursor-pointer hover:bg-secondary/30">
                      <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="w-3.5 h-3.5 accent-primary flex-shrink-0" />
                      <span className="w-20 font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>N° {b.numero}</span>
                      <span className="w-28 text-muted-foreground truncate">{b.periode}</span>
                      <span className="flex-1 text-muted-foreground truncate">{b.compagnies.map((c) => c.nom).join(", ") || "—"}</span>
                      <span className="w-16 text-center text-muted-foreground">{b.nbPrisesEnCharge} l.</span>
                      <span className="w-28 text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(b.montantNet)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <Btn variant="primary" onClick={handleGenerer} disabled={generating || selected.length === 0 || !lotActif}>
            {generating ? "Génération…" : `Générer la lettre chèque (${selected.length})`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

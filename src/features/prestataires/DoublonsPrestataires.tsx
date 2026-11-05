import { useEffect, useMemo, useState } from "react";
import { Merge, X, Loader2, EyeOff, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { getDoublonsPrestataires, fusionnerPrestataires, type FicheDoublon } from "@/services/prestataires.service";
import type { Prestataire } from "@/types/prestataires";

const CLE_IGNORES = "medassur-doublons-prestataires-ignores";
const cleGroupe = (g: FicheDoublon[]) => g.map((f) => f.id).sort().join("|");
function lireIgnores(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLE_IGNORES) ?? "[]")); } catch { return new Set(); }
}
const champ = "h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

function resume(bilan: Record<string, number>) {
  const parties = Object.entries(bilan).map(([k, v]) => `${v} ${k}`);
  return parties.length ? parties.join(", ") : "aucune donnée liée";
}

// Un groupe de fiches à fusionner : choix de la fiche conservée, des fiches absorbées, du nom et de la ville retenus.
function GroupeFusion({ fiches, onFusionne, onIgnorer }: { fiches: FicheDoublon[]; onFusionne: (ids: string[]) => void; onIgnorer?: () => void }) {
  const [conserverId, setConserverId] = useState(fiches[0].id);
  // Rien n'est coché d'avance : chaque fiche à absorber est choisie explicitement.
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const conserve = fiches.find((f) => f.id === conserverId)!;
  const [nom, setNom] = useState(conserve.nom.trim());
  const [ville, setVille] = useState(conserve.ville ?? "");
  const [encours, setEncours] = useState(false);
  const villes = useMemo(() => [...new Set(fiches.map((f) => f.ville).filter((v): v is string => !!v))], [fiches]);
  const absorber = fiches.filter((f) => f.id !== conserverId && coches.has(f.id));

  const choisir = (f: FicheDoublon) => {
    setConserverId(f.id);
    setNom(f.nom.trim());
    setVille(f.ville ?? "");
    setCoches((c) => { const n = new Set(c); n.delete(f.id); return n; });
  };

  const fusionner = async () => {
    if (!absorber.length) return;
    const total = absorber.reduce((s, f) => s + f.nbFactures, 0);
    if (!window.confirm(`Fusionner ${absorber.length} fiche(s) dans « ${nom} » (${ville || "ville inchangée"}) ?\n\n${absorber.map((f) => `• ${f.nom} [${f.ville ?? "?"}] — ${f.nbFactures} facture(s)`).join("\n")}\n\n${total} facture(s), leurs prestations, règlements, médecins et comptes portail seront rattachés à la fiche conservée. Les fiches absorbées seront supprimées. Action irréversible.`)) return;
    setEncours(true);
    try {
      const r = await fusionnerPrestataires({ conserverId, absorberIds: absorber.map((f) => f.id), nom, ville: ville || undefined });
      toast.success(`« ${r.nom} » : ${r.absorbes.length} fiche(s) fusionnée(s) — ${resume(r.bilan)}.`);
      onFusionne(absorber.map((f) => f.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fusion impossible.");
    } finally {
      setEncours(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-semibold">Conserver</th>
              <th className="px-3 py-2 text-left font-semibold">Fusionner</th>
              <th className="px-3 py-2 text-left font-semibold">Nom</th>
              <th className="px-3 py-2 text-left font-semibold">Ville</th>
              <th className="px-3 py-2 text-right font-semibold">Factures</th>
              <th className="px-3 py-2 text-right font-semibold">Prestations</th>
              <th className="px-3 py-2 text-right font-semibold">Règlements</th>
            </tr>
          </thead>
          <tbody>
            {fiches.map((f) => {
              const garde = f.id === conserverId;
              return (
                <tr key={f.id} className={`border-b border-border/50 ${garde ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2"><input type="radio" aria-label={`Conserver ${f.nom}`} checked={garde} onChange={() => choisir(f)} className="accent-primary" /></td>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Fusionner ${f.nom}`} disabled={garde} checked={garde || coches.has(f.id)}
                      onChange={(e) => setCoches((c) => { const n = new Set(c); if (e.target.checked) n.add(f.id); else n.delete(f.id); return n; })} className="accent-primary" />
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">{f.nom}{f.type ? <span className="ml-1.5 text-[11px] text-muted-foreground">({f.type})</span> : null}</td>
                  <td className="px-3 py-2 text-foreground">{f.ville ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-foreground">{f.nbFactures}</td>
                  <td className="px-3 py-2 text-right text-foreground">{f.nbPrestations}</td>
                  <td className="px-3 py-2 text-right text-foreground">{f.nbReglements}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 flex flex-wrap items-end gap-2.5">
        <label className="flex-1 min-w-[220px]"><span className="block text-[11.5px] text-muted-foreground mb-1">Nom retenu</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className={champ} /></label>
        <label className="w-48"><span className="block text-[11.5px] text-muted-foreground mb-1">Ville retenue</span>
          <input list={`villes-${conserverId}`} value={ville} onChange={(e) => setVille(e.target.value)} className={champ} />
          <datalist id={`villes-${conserverId}`}>{villes.map((v) => <option key={v} value={v} />)}</datalist>
        </label>
        <button type="button" onClick={fusionner} disabled={encours || !absorber.length || !nom.trim()}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50">
          {encours ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Merge className="w-4 h-4" aria-hidden />}
          Fusionner {absorber.length ? `(${absorber.length + 1} fiches)` : ""}
        </button>
        {onIgnorer && (
          <button type="button" onClick={onIgnorer} className="h-9 px-3 rounded-lg border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/50">
            <EyeOff className="w-4 h-4" aria-hidden />Pas un doublon
          </button>
        )}
      </div>
    </div>
  );
}

export function DoublonsPrestataires({ prestataires, onFerme, onFusionne }: {
  prestataires: Prestataire[];
  onFerme: () => void;
  onFusionne: (idsSupprimes: string[]) => void;
}) {
  const [groupes, setGroupes] = useState<FicheDoublon[][] | null>(null);
  const [ignores, setIgnores] = useState(lireIgnores);
  const [voirIgnores, setVoirIgnores] = useState(false);
  const [filtre, setFiltre] = useState("");
  const [manuel, setManuel] = useState<Prestataire[]>([]);

  useEffect(() => { getDoublonsPrestataires().then(setGroupes).catch((e) => { toast.error(e instanceof Error ? e.message : "Détection impossible."); setGroupes([]); }); }, []);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFerme(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFerme]);

  const ignorer = (g: FicheDoublon[]) => {
    const n = new Set(ignores).add(cleGroupe(g));
    setIgnores(n);
    try { localStorage.setItem(CLE_IGNORES, JSON.stringify([...n])); } catch { /* stockage indisponible */ }
  };
  const apresFusion = (ids: string[]) => {
    setGroupes((gs) => gs?.map((g) => g.filter((f) => !ids.includes(f.id))).filter((g) => g.length > 1) ?? null);
    setManuel([]);
    onFusionne(ids);
  };

  const visibles = (groupes ?? []).filter((g) => (voirIgnores || !ignores.has(cleGroupe(g)))
    && (!filtre.trim() || g.some((f) => f.nom.toLowerCase().includes(filtre.trim().toLowerCase()))));
  const nbIgnores = (groupes ?? []).filter((g) => ignores.has(cleGroupe(g))).length;

  // Fusion manuelle : fiches choisies librement (doublons non détectés, ex. sigle et nom complet).
  const fichesManuelles: FicheDoublon[] = manuel.map((p) => ({
    id: p.id, nom: p.nom, ville: p.ville ?? null, type: p.type ?? null, telephone: p.telephone ?? null, adresse: p.adresse ?? null,
    nbFactures: 0, nbPrestations: 0, nbReglements: 0,
  }));
  const candidatsManuels = prestataires.filter((p) => !manuel.some((m) => m.id === p.id));

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onFerme(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="titre-doublons" className="w-full max-w-5xl h-[100dvh] sm:h-[92vh] bg-card sm:border border-border sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Merge className="w-5 h-5 text-primary" aria-hidden />
          <div className="flex-1">
            <h2 id="titre-doublons" className="text-[16px] font-semibold text-foreground">Doublons de prestataires</h2>
            <p className="text-[12px] text-muted-foreground">Toutes les données des fiches fusionnées (factures, prestations, règlements, médecins, comptes portail) passent sur la fiche conservée.</p>
          </div>
          <button type="button" onClick={onFerme} aria-label="Fermer" className="h-9 w-9 rounded-lg inline-flex items-center justify-center hover:bg-secondary/50"><X className="w-5 h-5" aria-hidden /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section aria-labelledby="titre-manuel" className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <h3 id="titre-manuel" className="text-[13.5px] font-semibold text-foreground">Fusion manuelle</h3>
            <p className="text-[12px] text-muted-foreground">Pour des doublons que la détection ne trouve pas (sigle et nom complet, ex. « SOGEHO » et « Polyclinique Chambrier »). Ajoutez les fiches puis choisissez celle à conserver.</p>
            <div className="max-w-md">
              <Combobox options={candidatsManuels} value={null} onChange={(p) => p && setManuel((m) => [...m, p])}
                getLabel={(p) => p.nom} getSubLabel={(p) => p.ville ?? ""} getId={(p) => p.id} placeholder="Ajouter un prestataire…" />
            </div>
            {fichesManuelles.length >= 2 && <GroupeFusion key={fichesManuelles.map((f) => f.id).join("|")} fiches={fichesManuelles} onFusionne={apresFusion} />}
            {fichesManuelles.length === 1 && <p className="text-[12px] text-muted-foreground inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" aria-hidden />Ajoutez au moins une autre fiche ({fichesManuelles[0].nom} sélectionnée).</p>}
          </section>

          <section aria-labelledby="titre-detectes" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 id="titre-detectes" className="text-[13.5px] font-semibold text-foreground">
                Doublons probables {groupes ? `(${visibles.length} groupe${visibles.length > 1 ? "s" : ""})` : ""}
              </h3>
              <div className="relative ml-auto w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer par nom" aria-label="Filtrer les groupes par nom" className={`${champ} pl-8`} />
              </div>
              {nbIgnores > 0 && (
                <label className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={voirIgnores} onChange={(e) => setVoirIgnores(e.target.checked)} className="accent-primary" />Afficher les {nbIgnores} groupe(s) écarté(s)
                </label>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground">Vérifiez chaque groupe : la détection rapproche les noms proches d'un même type d'établissement, mais deux structures distinctes peuvent porter un nom voisin. Par défaut, la fiche au nom le plus complet est conservée.</p>
            {!groupes && <p className="text-[13px] text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Recherche des doublons…</p>}
            {groupes && visibles.length === 0 && <p className="text-[13px] text-muted-foreground">Aucun doublon probable.</p>}
            {visibles.map((g) => <GroupeFusion key={cleGroupe(g)} fiches={g} onFusionne={apresFusion} onIgnorer={() => ignorer(g)} />)}
          </section>
        </div>
      </div>
    </div>
  );
}

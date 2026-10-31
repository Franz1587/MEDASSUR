import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileDown, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { updateCotation } from "@/services/cotation.service";
import { enregistrerParametresOffre, getParametresOffre } from "@/services/appelOffres.service";
import { openOffreSante } from "@/services/documents.service";
import type { Compagnie } from "@/types/compagnies";
import type { ContenuOffre, Cotation, ParametresOffre, SectionGaranties } from "@/types/cotation";

// Offre santé (2026-10) — relecture des cotations lues par ARIANA dans les
// propositions des compagnies, puis génération du document complet au
// format LA RUCHE (voir backend/src/documents/offre-sante.pdf.ts).

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const cellCls = "w-full border border-border rounded-md px-2 py-1.5 bg-background text-[12.5px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const lignes = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
// Même règle que calculerPrimes (backend) : cartes non taxées.
const ttcDe = (net: number, cartes: number, acc: number) => net + cartes + acc + Math.round((net + acc) * 0.08);

export function RelectureCotationModal({ cotation, compagnies, onClose, onSaved }: {
  cotation: Cotation; compagnies: Compagnie[]; onClose: () => void; onSaved: () => void;
}) {
  const c0 = cotation.contenuOffre as ContenuOffre;
  const [contenu, setContenu] = useState<ContenuOffre>(() => structuredClone(c0));
  const [compagnieId, setCompagnieId] = useState(cotation.compagnieId ?? "");
  const [primeNette, setPrimeNette] = useState(cotation.primeNette);
  const [cartes, setCartes] = useState(cotation.montantCartes);
  const [accessoires, setAccessoires] = useState(cotation.montantAccessoires);
  const [saving, setSaving] = useState(false);
  const maj = (p: Partial<ContenuOffre>) => setContenu((c) => ({ ...c, ...p }));
  const tableau = contenu.tableau;
  const majSection = (i: number, s: Partial<SectionGaranties>) =>
    maj({ tableau: tableau && { ...tableau, sections: tableau.sections.map((x, k) => (k === i ? { ...x, ...s } : x)) } });

  const enregistrer = async () => {
    if (!compagnieId) { toast.error("Choisissez la compagnie de cette proposition."); return; }
    setSaving(true);
    try {
      await updateCotation(cotation.id, { compagnieId, population: contenu.population, primeNette, montantCartes: cartes, montantAccessoires: accessoires, contenuOffre: contenu });
      toast.success("Cotation enregistrée.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="relecture-titre">
      <div className="w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 id="relecture-titre" className="text-[15px] font-semibold text-foreground">Relecture — {cotation.compagnie?.nom ?? "Compagnie à choisir"} · {cotation.branche}</h3>
            <p className="text-[12px] text-muted-foreground">{cotation.conditionsFermete}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5">
          {contenu.remarques && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Points à vérifier (ARIANA) :</span> {contenu.remarques}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <div className={labelCls}>Compagnie</div>
              <Combobox options={compagnies} value={compagnies.find((c) => c.id === compagnieId) ?? null} onChange={(c) => setCompagnieId(c?.id ?? "")} getLabel={(c) => c.nom} getId={(c) => c.id} placeholder="Rechercher…" />
            </label>
            <label className="block">
              <div className={labelCls}>Population (personnes)</div>
              <input type="number" min={1} value={contenu.population} onChange={(e) => maj({ population: Number(e.target.value) })} className={fieldCls} />
            </label>
            <label className="flex items-center gap-2 pt-6 text-[13px] text-foreground">
              <input type="checkbox" checked={!!contenu.primeNonCommuniquee} onChange={(e) => maj({ primeNonCommuniquee: e.target.checked })} className="w-4 h-4 accent-primary" />
              Prime non communiquée
            </label>
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-foreground mb-2">Décompte de prime</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {([["Prime nette (FCFA)", primeNette, setPrimeNette], ["Cartes (FCFA)", cartes, setCartes], ["Accessoires (FCFA)", accessoires, setAccessoires]] as const).map(([l, v, set]) => (
                <label key={l} className="block"><div className={labelCls}>{l}</div>
                  <input type="number" min={0} value={v} onChange={(e) => set(Number(e.target.value))} className={fieldCls} /></label>
              ))}
              <label className="block"><div className={labelCls}>Prime nette / personne</div>
                <input type="number" min={0} value={contenu.primeParPersonne ?? 0} onChange={(e) => maj({ primeParPersonne: Number(e.target.value) || null })} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Avant réduction / pers.</div>
                <input type="number" min={0} value={contenu.primeCommuniquee ?? 0} onChange={(e) => maj({ primeCommuniquee: Number(e.target.value) || null })} className={fieldCls} /></label>
            </div>
            <p className="text-[12px] text-muted-foreground mt-2">
              Prime TTC recalculée : <span className="font-semibold text-foreground med-num">{fmtM(ttcDe(primeNette, cartes, accessoires))} FCFA</span> (taxe 8 % sur prime nette + accessoires)
              {contenu.controleCompagnie?.ttc ? <> — TTC écrit par la compagnie : <span className="med-num">{fmtM(contenu.controleCompagnie.ttc)} FCFA</span></> : null}
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block"><div className={labelCls}>Titre du bandeau (une ligne par ligne)</div>
              <textarea rows={4} value={contenu.titre.join("\n")} onChange={(e) => maj({ titre: lignes(e.target.value) })} className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Désignation du récapitulatif</div>
              <textarea rows={4} value={contenu.designationRecap.join("\n")} onChange={(e) => maj({ designationRecap: lignes(e.target.value) })} className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Libellé du comparatif</div>
              <textarea rows={4} value={contenu.libelleComparatif} onChange={(e) => maj({ libelleComparatif: e.target.value })} className={fieldCls} />
              <span className="text-[11px] text-muted-foreground">Même libellé = même ligne pour toutes les compagnies.</span></label>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block"><div className={labelCls}>Garanties (une par ligne)</div>
              <textarea rows={9} value={contenu.garanties.join("\n")} onChange={(e) => maj({ garanties: lignes(e.target.value) })} className={fieldCls} /></label>
            <div>
              <div className={labelCls}>Limite de garantie</div>
              <div className="space-y-2">
                {contenu.limites.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <textarea rows={2} value={l.texte} onChange={(e) => maj({ limites: contenu.limites.map((x, k) => (k === i ? { ...x, texte: e.target.value } : x)) })} className={cellCls} aria-label={`Limite ${i + 1}`} />
                      {l.detail != null && <input value={l.detail} onChange={(e) => maj({ limites: contenu.limites.map((x, k) => (k === i ? { ...x, detail: e.target.value } : x)) })} className={cellCls} aria-label={`Suite de la limite ${i + 1}`} />}
                    </div>
                    <button type="button" aria-label="Supprimer cette limite" onClick={() => maj({ limites: contenu.limites.filter((_, k) => k !== i) })} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => maj({ limites: [...contenu.limites, { texte: "" }] })} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une limite</button>
              </div>
            </div>
          </section>

          {tableau && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-[13px] font-semibold text-foreground">Tableau de garanties</h4>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-muted-foreground">Présentation</span>
                  <select value={tableau.style} onChange={(e) => maj({ tableau: { ...tableau, style: e.target.value as "grille" | "colonnes" } })} className="h-9 px-2 rounded-lg border border-border bg-background text-[12.5px] text-foreground">
                    <option value="grille">Grille LA RUCHE (rubriques)</option>
                    <option value="colonnes">Colonnes Garanties / Taux / Plafond</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <label className="block"><div className={labelCls}>Territorialité</div><input value={tableau.territorialite} onChange={(e) => maj({ tableau: { ...tableau, territorialite: e.target.value } })} className={fieldCls} /></label>
                {tableau.style === "grille"
                  ? <label className="block md:col-span-2"><div className={labelCls}>Titre du collège</div><input value={tableau.titreCollege ?? ""} onChange={(e) => maj({ tableau: { ...tableau, titreCollege: e.target.value } })} className={fieldCls} /></label>
                  : <label className="block md:col-span-2"><div className={labelCls}>En-tête colonne garanties</div><input value={tableau.titreColonneGaranties ?? ""} onChange={(e) => maj({ tableau: { ...tableau, titreColonneGaranties: e.target.value } })} className={fieldCls} /></label>}
              </div>
              <div className="space-y-3">
                {tableau.sections.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border">
                    <div className="flex flex-wrap gap-2 p-2 bg-secondary/40 rounded-t-lg">
                      <input value={s.titre ?? ""} placeholder="Rubrique (ex. HOSPITALISATION)" onChange={(e) => majSection(i, { titre: e.target.value })} className={`${cellCls} flex-1 min-w-[180px] font-semibold`} aria-label="Titre de la rubrique" />
                      <input value={s.plafondCommun ?? ""} placeholder="Plafond commun à la rubrique" onChange={(e) => majSection(i, { plafondCommun: e.target.value || null })} className={`${cellCls} flex-1 min-w-[180px]`} aria-label="Plafond commun" />
                      <button type="button" aria-label="Supprimer la rubrique" onClick={() => maj({ tableau: { ...tableau, sections: tableau.sections.filter((_, k) => k !== i) } })} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="p-2 space-y-1.5 overflow-x-auto">
                      {s.lignes.map((l, j) => (
                        <div key={j} className="grid grid-cols-[minmax(160px,2fr)_minmax(80px,1fr)_minmax(140px,2fr)_36px] gap-1.5 items-center">
                          {(["libelle", "taux", "plafond"] as const).map((k) => (
                            <input key={k} value={l[k] ?? ""} placeholder={k === "libelle" ? "Garantie" : k === "taux" ? "Taux" : "Plafond"} aria-label={k}
                              onChange={(e) => majSection(i, { lignes: s.lignes.map((x, m) => (m === j ? { ...x, [k]: e.target.value } : x)) })} className={cellCls} />
                          ))}
                          <button type="button" aria-label="Supprimer la ligne" onClick={() => majSection(i, { lignes: s.lignes.filter((_, m) => m !== j) })} className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => majSection(i, { lignes: [...s.lignes, { libelle: "", taux: "", plafond: "" }] })} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ligne</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => maj({ tableau: { ...tableau, sections: [...tableau.sections, { titre: "", lignes: [] }] } })} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une rubrique</button>
              </div>
              {tableau.style === "grille" && (
                <label className="block mt-3"><div className={labelCls}>Pied du tableau</div><input value={tableau.piedTableau ?? ""} onChange={(e) => maj({ tableau: { ...tableau, piedTableau: e.target.value } })} className={fieldCls} /></label>
              )}
            </section>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <button type="button" disabled={saving} onClick={enregistrer} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"><Save className="w-4 h-4" />{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </div>
  );
}

export function OffreSantePanel({ appelOffresId, cotations }: { appelOffresId: string; cotations: Cotation[] }) {
  const analysees = useMemo(() => cotations.filter((c) => c.contenuOffre), [cotations]);
  const [params, setParams] = useState<ParametresOffre | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setParams(null); getParametresOffre(appelOffresId).then(setParams).catch(() => toast.error("Paramètres de l'offre indisponibles.")); }, [appelOffresId]);

  const compagnies = useMemo(() => {
    const vues = new Map<string, string>();
    for (const c of analysees) if (c.compagnieId) vues.set(c.compagnieId, c.compagnie?.nom ?? c.compagnieId);
    const ordre = params?.ordreCompagnies ?? [];
    return [...vues.entries()].sort(([a], [b]) => (ordre.includes(a) ? ordre.indexOf(a) : 999) - (ordre.includes(b) ? ordre.indexOf(b) : 999));
  }, [analysees, params?.ordreCompagnies]);

  if (!analysees.length) return null;
  const set = (p: Partial<ParametresOffre>) => setParams((v) => (v ? { ...v, ...p } : v));
  const exclues = new Set(params?.cotationIdsExclues ?? []);
  const deplacer = (i: number, d: -1 | 1) => {
    const ids = compagnies.map(([id]) => id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    set({ ordreCompagnies: ids });
  };

  const generer = async () => {
    if (!params) return;
    setBusy(true);
    try {
      await enregistrerParametresOffre(appelOffresId, { ...params, ordreCompagnies: compagnies.map(([id]) => id) });
      await openOffreSante(appelOffresId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération de l'offre impossible.");
    } finally {
      setBusy(false);
    }
  };

  const champ = (k: keyof ParametresOffre, l: string) => (
    <label className="block"><div className={labelCls}>{l}</div>
      <input value={String(params?.[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<ParametresOffre>)} className={fieldCls} /></label>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Offre santé</h3>
          <p className="text-[12px] text-muted-foreground">{analysees.length} cotation(s) lue(s) par ARIANA · {compagnies.length} compagnie(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={() => setOuvert((o) => !o)}>{ouvert ? "Masquer les paramètres" : "Paramètres"}</Btn>
          <Btn variant="primary" onClick={generer} disabled={busy || !params}><FileDown className="w-4 h-4" />{busy ? "Génération…" : "Générer l'offre (PDF)"}</Btn>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {compagnies.map(([id, nom], i) => (
          <div key={id} className="rounded-lg bg-secondary/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">{i + 1}. {nom}</span>
              <span className="flex items-center gap-1">
                <button type="button" aria-label={`Monter ${nom}`} disabled={i === 0} onClick={() => deplacer(i, -1)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" aria-label={`Descendre ${nom}`} disabled={i === compagnies.length - 1} onClick={() => deplacer(i, 1)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              </span>
            </div>
            {analysees.filter((c) => c.compagnieId === id).map((c) => (
              <label key={c.id} className="flex items-center justify-between gap-2 text-[12.5px] py-0.5 cursor-pointer">
                <span className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={!exclues.has(c.id)} className="w-4 h-4 accent-primary"
                    onChange={(e) => set({ cotationIdsExclues: e.target.checked ? [...exclues].filter((x) => x !== c.id) : [...exclues, c.id] })} />
                  <Badge variant="gold">{c.branche}</Badge>
                  <span className="text-foreground truncate">{c.contenuOffre?.libelleComparatif}</span>
                </span>
                <span className="text-muted-foreground med-num flex-shrink-0">{c.contenuOffre?.primeNonCommuniquee ? "Non communiqué" : `${fmtM(c.primeTTC)} FCFA`}</span>
              </label>
            ))}
          </div>
        ))}
        {analysees.some((c) => !c.compagnieId) && (
          <p className="text-[12px] text-amber-700 dark:text-amber-300">Certaines cotations n'ont pas de compagnie : ouvrez « Relire » pour la choisir.</p>
        )}
      </div>

      {ouvert && params && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
          {champ("titreDocument", "Titre de la couverture")}
          {champ("exercice", "Exercice (récapitulatif)")}
          {champ("date", "Date")}
          {champ("chargeClientele", "Chargé(e) clientèle")}
          <label className="block md:col-span-2"><div className={labelCls}>Rédacteur (une ligne par ligne)</div>
            <textarea rows={2} value={params.redacteur.join("\n")} onChange={(e) => set({ redacteur: lignes(e.target.value) })} className={fieldCls} /></label>
          {champ("telephone", "Téléphone")}
          {champ("telecopie", "Télécopie")}
          {champ("adresseAssure", "Adresse de l'assuré")}
          {champ("periode", "Période de garantie")}
          {champ("duree", "Durée")}
          {champ("mentionSignature", "Signature du récapitulatif")}
          {champ("lieuSignature", "Lieu (annexe)")}
          <div className="flex flex-col gap-2 pt-6">
            <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={params.pagesPresentation} onChange={(e) => set({ pagesPresentation: e.target.checked })} className="w-4 h-4 accent-primary" />Pages de présentation (outils, carte santé, applications)</label>
            <label className="flex items-center gap-2 text-[13px] text-foreground"><input type="checkbox" checked={params.annexeReseau} onChange={(e) => set({ annexeReseau: e.target.checked })} className="w-4 h-4 accent-primary" />Annexe réseau de soins</label>
          </div>
        </div>
      )}
    </div>
  );
}

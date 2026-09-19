import { useEffect, useState } from "react";
import {
  Receipt, Plus, Check, Ban, TrendingUp, Wallet, AlertTriangle, Clock, X, Trash2, BookOpen, Scale, ScrollText,
  FileDown, Tag, BookText, Table2, TrendingDown, Landmark, ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmt } from "@/lib/format";
import {
  getFacturesAbonnement, getResumeFacturation, genererFactureAbonnement, suggererLignesFacturation,
  payerFactureAbonnement, annulerFactureAbonnement, getSocietes,
  getBalanceAgee, getEtatTaxes, getGrandLivre, getRubriquesFacturation, creerRubriqueFacturation, ouvrirFacturePdf,
  getJournalOhada, getBalanceOhada, getCompteDeResultat, getBilan, getLettrageClients,
} from "@/services/societes.service";
import type {
  FactureAbonnement, ResumeFacturation, Societe, LigneFactureInput, BalanceAgee, EtatTaxes, GrandLivre, RubriqueFacturation,
  JournalOhada, BalanceOhada, CompteDeResultat, Bilan, LettrageSociete,
} from "@/types/societes";
import { TAUX_LEGAUX } from "@/types/societes";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const MOIS_LABELS: Record<string, string> = { "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin", "07": "Juil", "08": "Août", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc" };

function statutVariant(statut: FactureAbonnement["statut"]): "success" | "warning" | "danger" {
  if (statut === "Payee") return "success";
  if (statut === "Emise") return "warning";
  return "danger";
}

function ligneVide(): LigneFactureInput {
  return { designation: "", quantite: 1, prixUnitaire: 0 };
}

// Ajout rapide d'une rubrique (2026-09) — voir demande utilisateur : "les
// options ou les rubriques de la facture doivent pouvoir être ajoutées."
// Utilisable directement depuis le formulaire de facture (sans y quitter),
// la gestion complète (modifier/désactiver/supprimer) reste dans l'écran
// Tarification.
function NouvelleRubriqueModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: RubriqueFacturation) => void }) {
  const [libelle, setLibelle] = useState("");
  const [prixDefaut, setPrixDefaut] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!libelle.trim()) { setError("Le libellé est obligatoire."); return; }
    const code = libelle.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    try {
      setSaving(true);
      setError(null);
      const r = await creerRubriqueFacturation({ libelle: libelle.trim(), code, prixDefaut: prixDefaut ? Number(prixDefaut) : undefined });
      toast.success(`Rubrique "${r.libelle}" créée.`);
      onCreated(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[97] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">Nouvelle rubrique</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{error}</p>}
          <label className="block"><div className={labelCls}>Libellé *</div><input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="ex. Récupération de données" className={fieldCls} autoFocus /></label>
          <label className="block"><div className={labelCls}>Prix par défaut (FCFA, facultatif)</div><input type="number" min={0} value={prixDefaut} onChange={(e) => setPrixDefaut(e.target.value)} className={fieldCls} /></label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>Créer</Btn>
        </div>
      </div>
    </div>
  );
}

// Formulaire de facturation (2026-09) — voir demande utilisateur : "le
// formulaire de facturation... ne fonctionne toujours pas comme une
// facturation dédiée." Une vraie facture se compose TOUJOURS ligne par
// ligne — plus de "mode automatique" qui verrouille l'écran derrière un
// type : les 3 boutons d'insertion rapide (Abonnement/Installation/Cartes)
// demandent au serveur de CALCULER une ligne (voir FactureAbonnementService.
// suggererLignes) et l'AJOUTENT à l'éditeur, librement modifiable ou
// supprimable ensuite comme n'importe quelle autre ligne. "Type" reste un
// simple classement (Journal/filtres), jamais une contrainte de saisie.
function GenererFactureModal({ societes, onClose, onSaved }: { societes: Societe[]; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"Abonnement" | "Installation" | "Cartes" | "Autre">("Abonnement");
  const [societeId, setSocieteId] = useState("");
  const [lignes, setLignes] = useState<LigneFactureInput[]>([]);
  const [nombrePersonnesCarte, setNombrePersonnesCarte] = useState("");
  const [insertion, setInsertion] = useState<"Abonnement" | "Installation" | "Cartes" | null>(null);
  const [appliquerTva, setAppliquerTva] = useState(true);
  const [tauxTva, setTauxTva] = useState(TAUX_LEGAUX.tva);
  const [appliquerTps, setAppliquerTps] = useState(false);
  const [tauxTps, setTauxTps] = useState(TAUX_LEGAUX.tps);
  const [appliquerCss, setAppliquerCss] = useState(false);
  const [tauxCss, setTauxCss] = useState(TAUX_LEGAUX.css);
  const [dateEcheance, setDateEcheance] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rubriques de facturation (2026-09) — voir demande utilisateur : "les
  // rubriques font référence aux différentes lignes de facturation." Pré-
  // remplissent une ligne (désignation + prix par défaut) sans jamais
  // imposer une saisie figée — la ligne reste éditable après sélection.
  const [rubriques, setRubriques] = useState<RubriqueFacturation[]>([]);
  const [showNouvelleRubrique, setShowNouvelleRubrique] = useState(false);
  useEffect(() => { getRubriquesFacturation().then(setRubriques).catch(() => undefined); }, []);

  // Fiscalité gabonaise (2026-09) — voir demande utilisateur : "la TPS
  // n'est pas additive, mais soustractive. Mais, TPS et CSS se calculent
  // sur le montant HT." Chaque taxe part du même HT (jamais en cascade) ;
  // TVA et CSS s'ajoutent, la TPS se retranche — même formule que
  // FactureAbonnementService.genererFacture (le serveur refait ce calcul
  // à l'identique à l'enregistrement, ceci n'est qu'un aperçu).
  const montantHT = lignes.reduce((s, l) => s + (l.quantite ?? 1) * (l.prixUnitaire || 0), 0);
  const montantTva = appliquerTva ? Math.round((montantHT * tauxTva) / 100) : 0;
  const montantTps = appliquerTps ? Math.round((montantHT * tauxTps) / 100) : 0;
  const montantCss = appliquerCss ? Math.round((montantHT * tauxCss) / 100) : 0;
  const montantTTC = montantHT + montantTva - montantTps + montantCss;

  const majLigne = (i: number, patch: Partial<LigneFactureInput>) => setLignes((v) => v.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const ajouterLigne = () => setLignes((v) => [...v, ligneVide()]);
  const retirerLigne = (i: number) => setLignes((v) => v.filter((_, idx) => idx !== i));

  // Insertion rapide (2026-09) — demande au serveur de calculer la ligne
  // (montant dérivé du tarif des modules souscrits + licence par assuré,
  // du prix négocié, ou du tarif carte × population) et l'ajoute à
  // l'éditeur — jamais un mode séparé, juste un raccourci de saisie.
  const handleInsertionRapide = async (t: "Abonnement" | "Installation" | "Cartes") => {
    if (!societeId) { setError("Choisissez une société avant d'insérer une ligne calculée."); return; }
    try {
      setInsertion(t);
      setError(null);
      const nouvelles = await suggererLignesFacturation(societeId, t, t === "Cartes" && nombrePersonnesCarte ? Number(nombrePersonnesCarte) : undefined);
      setLignes((v) => [...v, ...nouvelles]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calcul impossible.");
    } finally {
      setInsertion(null);
    }
  };

  const handleSave = async () => {
    if (!societeId) { setError("Choisissez une société."); return; }
    if (lignes.length === 0) { setError("Ajoutez au moins une ligne — via l'insertion rapide ou \"Ajouter une ligne\"."); return; }
    if (lignes.some((l) => !l.designation.trim() || !l.prixUnitaire)) {
      setError("Chaque ligne doit avoir une désignation et un prix unitaire.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await genererFactureAbonnement(societeId, {
        type,
        lignes: lignes.map((l) => ({ ...l, quantite: l.quantite ?? 1 })),
        appliquerTva, tauxTva: appliquerTva ? tauxTva : undefined,
        appliquerTps, tauxTps: appliquerTps ? tauxTps : undefined,
        appliquerCss, tauxCss: appliquerCss ? tauxCss : undefined,
        dateEcheance: dateEcheance || undefined,
        note: note || undefined,
      });
      toast.success("Facture générée.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">Générer une facture</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && <p className="text-[12.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><div className={labelCls}>Société *</div>
              <Combobox
                options={societes}
                value={societes.find((s) => s.id === societeId) ?? null}
                onChange={(s) => setSocieteId(s?.id ?? "")}
                getLabel={(s) => s.nom}
                getSubLabel={(s) => s.ville ?? ""}
                getId={(s) => s.id}
                placeholder="Rechercher une société…"
              />
            </label>
            <label className="block"><div className={labelCls}>Catégorie (classement du journal)</div>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={fieldCls}>
                <option value="Abonnement">Abonnement</option>
                <option value="Installation">Installation</option>
                <option value="Cartes">Cartes</option>
                <option value="Autre">Autre</option>
              </select>
            </label>
          </div>

          <div>
            <div className={labelCls}>INSERTION RAPIDE — ligne calculée par le serveur</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => handleInsertionRapide("Abonnement")} disabled={insertion !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[12px] font-semibold hover:bg-primary/10 disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" />{insertion === "Abonnement" ? "Calcul…" : "Abonnement (modules + licence)"}
              </button>
              <button type="button" onClick={() => handleInsertionRapide("Installation")} disabled={insertion !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[12px] font-semibold hover:bg-primary/10 disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" />{insertion === "Installation" ? "Calcul…" : "Frais d'installation"}
              </button>
              <button type="button" onClick={() => handleInsertionRapide("Cartes")} disabled={insertion !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[12px] font-semibold hover:bg-primary/10 disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" />{insertion === "Cartes" ? "Calcul…" : "Cartes d'assurance"}
              </button>
              <input type="number" min={1} value={nombrePersonnesCarte} onChange={(e) => setNombrePersonnesCarte(e.target.value)} placeholder="Nb. personnes (vide = population active)" className={`${fieldCls} w-56`} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className={labelCls}>LIGNES DE FACTURATION</div>
              <button type="button" onClick={() => setShowNouvelleRubrique(true)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"><Tag className="w-3 h-3" />Nouvelle rubrique</button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="text-left font-semibold px-2.5 py-1.5 w-40">Rubrique</th>
                    <th className="text-left font-semibold px-2.5 py-1.5">Désignation</th>
                    <th className="text-right font-semibold px-2.5 py-1.5 w-20">Qté</th>
                    <th className="text-right font-semibold px-2.5 py-1.5 w-32">Prix unitaire</th>
                    <th className="text-right font-semibold px-2.5 py-1.5 w-32">Montant</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-1.5">
                        <select
                          value={l.rubriqueCode ?? ""}
                          onChange={(e) => {
                            const rubrique = rubriques.find((r) => r.code === e.target.value);
                            majLigne(i, {
                              rubriqueCode: rubrique?.code,
                              designation: rubrique ? rubrique.libelle : l.designation,
                              prixUnitaire: rubrique?.prixDefaut ?? l.prixUnitaire,
                            });
                          }}
                          className="w-full bg-transparent outline-none text-[12px]"
                        >
                          <option value="">Libre…</option>
                          {rubriques.filter((r) => r.actif).map((r) => <option key={r.code} value={r.code}>{r.libelle}</option>)}
                        </select>
                      </td>
                      <td className="px-2.5 py-1.5"><input value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })} placeholder="ex. Licence MedAssur — module Contrats" className="w-full bg-transparent outline-none" /></td>
                      <td className="px-2.5 py-1.5"><input type="number" min={0.01} step="0.01" value={l.quantite ?? 1} onChange={(e) => majLigne(i, { quantite: Number(e.target.value) })} className="w-full bg-transparent outline-none text-right" /></td>
                      <td className="px-2.5 py-1.5"><input type="number" min={0} value={l.prixUnitaire || ""} onChange={(e) => majLigne(i, { prixUnitaire: Number(e.target.value) })} className="w-full bg-transparent outline-none text-right" /></td>
                      <td className="px-2.5 py-1.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt((l.quantite ?? 1) * (l.prixUnitaire || 0))}</td>
                      <td className="px-1 text-center">
                        <button type="button" onClick={() => retirerLigne(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {lignes.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-[12px]">Aucune ligne — utilisez l'insertion rapide ci-dessus ou "Ajouter une ligne".</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={ajouterLigne} className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter une ligne</button>
          </div>
          {showNouvelleRubrique && (
            <NouvelleRubriqueModal
              onClose={() => setShowNouvelleRubrique(false)}
              onCreated={(r) => { setRubriques((v) => [...v, r]); setShowNouvelleRubrique(false); }}
            />
          )}

          <div className={labelCls}>TAXES — GABON</div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: "TVA (s'ajoute au HT)", actif: appliquerTva, setActif: setAppliquerTva, taux: tauxTva, setTaux: setTauxTva },
              { label: "TPS (se retranche du HT)", actif: appliquerTps, setActif: setAppliquerTps, taux: tauxTps, setTaux: setTauxTps },
              { label: "CSS (s'ajoute au HT)", actif: appliquerCss, setActif: setAppliquerCss, taux: tauxCss, setTaux: setTauxCss },
            ] as const).map((t) => (
              <div key={t.label} className={`border rounded-lg p-2.5 ${t.actif ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground mb-1.5">
                  <input type="checkbox" checked={t.actif} onChange={(e) => t.setActif(e.target.checked)} className="rounded border-border" />
                  {t.label}
                </label>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} step="0.1" disabled={!t.actif} value={t.taux} onChange={(e) => t.setTaux(Number(e.target.value))} className={`${fieldCls} py-1 disabled:opacity-40`} />
                  <span className="text-[12px] text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-secondary/30 border border-border rounded-lg p-3 space-y-1 text-[12.5px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="text-foreground font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(montantHT)}</span></div>
            {appliquerTva && <div className="flex justify-between"><span className="text-muted-foreground">TVA ({tauxTva}%)</span><span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>+ {fmt(montantTva)}</span></div>}
            {appliquerTps && <div className="flex justify-between"><span className="text-muted-foreground">TPS ({tauxTps}%)</span><span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>− {fmt(montantTps)}</span></div>}
            {appliquerCss && <div className="flex justify-between"><span className="text-muted-foreground">CSS ({tauxCss}%)</span><span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>+ {fmt(montantCss)}</span></div>}
            <div className="flex justify-between pt-1 border-t border-border font-bold"><span className="text-foreground">Total TTC</span><span className="text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(montantTTC)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><div className={labelCls}>Échéance (JJ/MM/AAAA)</div><input value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} placeholder="15 jours par défaut" className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Note</div><input value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} /></label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>Générer</Btn>
        </div>
      </div>
    </div>
  );
}

function PayerModal({ facture, onClose, onSaved }: { facture: FactureAbonnement; onClose: () => void; onSaved: () => void }) {
  const [modePaiement, setModePaiement] = useState("Virement");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await payerFactureAbonnement(facture.id, { modePaiement, referencePaiement: referencePaiement || undefined });
      toast.success("Paiement enregistré.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-[15px] font-semibold text-foreground">Enregistrer le paiement</h3></div>
        <div className="p-5 space-y-3">
          <p className="text-[13px] text-muted-foreground">Facture n°{facture.numero} — {facture.societe.nom} — {fmt(facture.montantTTC)}</p>
          <label className="block"><div className={labelCls}>Mode de paiement</div>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={fieldCls}>
              {["Virement", "Chèque", "Espèces", "Mobile Money"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="block"><div className={labelCls}>Référence</div><input value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className={fieldCls} /></label>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" disabled={saving} onClick={handleSave}>Enregistrer</Btn>
        </div>
      </div>
    </div>
  );
}

function OngletFactures({ societes, refreshKey, onChanged }: { societes: Societe[]; refreshKey: number; onChanged: () => void }) {
  const [factures, setFactures] = useState<FactureAbonnement[]>([]);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [loading, setLoading] = useState(true);
  const [payerCible, setPayerCible] = useState<FactureAbonnement | null>(null);

  useEffect(() => {
    setLoading(true);
    getFacturesAbonnement(filtreStatut ? { statut: filtreStatut } : undefined).then(setFactures).finally(() => setLoading(false));
  }, [filtreStatut, refreshKey]);

  const handleAnnuler = async (f: FactureAbonnement) => {
    if (!window.confirm(`Annuler la facture n°${f.numero} de ${f.societe.nom} (${fmt(f.montantTTC)}) ?`)) return;
    try {
      await annulerFactureAbonnement(f.id);
      toast.success("Facture annulée.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Factures ({factures.length})</h3>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="border border-border rounded-lg px-2.5 py-1.5 bg-background text-[12.5px] text-foreground">
            <option value="">Tous statuts</option>
            <option value="Emise">Émise</option>
            <option value="Payee">Payée</option>
            <option value="Annulee">Annulée</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["N°", "Société", "Type", "HT", "TVA", "TPS", "CSS", "TTC", "Échéance", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="px-4 py-6 text-center text-muted-foreground text-xs">Chargement…</td></tr>}
              {!loading && factures.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune facture.</td></tr>}
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f.numero}</td>
                  <td className="px-3 py-2.5 font-semibold text-foreground text-sm whitespace-nowrap">{f.societe.nom}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{f.type}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmt(f.montantHT)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{f.tauxTva ? `${fmt(f.montantTva)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{f.tauxTps ? `${fmt(f.montantTps)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{f.tauxCss ? `${fmt(f.montantCss)}` : "—"}</td>
                  <td className="px-3 py-2.5 text-foreground font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(f.montantTTC)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{f.dateEcheance}</td>
                  <td className="px-3 py-2.5"><Badge variant={statutVariant(f.statut)}>{f.statut === "Emise" ? "Émise" : f.statut === "Payee" ? "Payée" : "Annulée"}</Badge></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button type="button" onClick={() => ouvrirFacturePdf(f.id).catch((err) => toast.error(err instanceof Error ? err.message : "Génération du PDF impossible."))} title="Télécharger la facture (PDF)" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><FileDown className="w-3.5 h-3.5" /></button>
                      {f.statut === "Emise" && (
                        <>
                          <button type="button" onClick={() => setPayerCible(f)} title="Enregistrer le paiement" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-emerald-600 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => handleAnnuler(f)} title="Annuler" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Ban className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {payerCible && <PayerModal facture={payerCible} onClose={() => setPayerCible(null)} onSaved={onChanged} />}
    </>
  );
}

function OngletBalanceAgee() {
  const [balance, setBalance] = useState<BalanceAgee | null>(null);
  useEffect(() => { getBalanceAgee().then(setBalance); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(balance?.parTranche ?? []).map((t) => (
          <div key={t.tranche} className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">{t.tranche}</p>
            <p className="text-[15px] font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(t.montant)}</p>
          </div>
        ))}
        {balance && balance.parTranche.length === 0 && <p className="col-span-4 text-[12.5px] text-muted-foreground text-center py-6">Aucun impayé — toutes les factures émises sont réglées.</p>}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["N°", "Société", "Montant", "Échéance", "Retard", "Tranche"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balance?.lignes.map((l) => (
              <tr key={l.id} className="border-b border-border/50">
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.numero}</td>
                <td className="px-3 py-2.5 font-semibold text-foreground text-sm">{l.societeNom}</td>
                <td className="px-3 py-2.5 text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(l.montant)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.dateEcheance}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.joursRetard > 0 ? `${l.joursRetard} j` : "—"}</td>
                <td className="px-3 py-2.5"><Badge variant={l.tranche === "À échoir" ? "info" : l.tranche === "+90j" ? "danger" : "warning"}>{l.tranche}</Badge></td>
              </tr>
            ))}
            {balance?.lignes.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune créance en cours.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// État des taxes (2026-09) — voir demande utilisateur : "malgré l'existence
// d'une facture, les données ne remontent pas" + "au Gabon... c'est le
// SYSCOHADA qui est en vigueur." Le SYSCOHADA suit une comptabilité
// D'ENGAGEMENT : une taxe est due dès l'ÉMISSION de la facture (compte
// 4434/4457), pas seulement à l'encaissement — "Facturé" (engagement) est
// donc le total qui fait foi, "Encaissé" (trésorerie réelle) reste une
// information complémentaire, jamais l'inverse.
function OngletTaxes() {
  const [etat, setEtat] = useState<EtatTaxes | null>(null);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");

  const refresh = () => { getEtatTaxes(du || undefined, au || undefined).then(setEtat); };
  useEffect(refresh, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="block"><div className={labelCls}>Du</div><input value={du} onChange={(e) => setDu(e.target.value)} placeholder="JJ/MM/AAAA" className={fieldCls} /></label>
        <label className="block"><div className={labelCls}>Au</div><input value={au} onChange={(e) => setAu(e.target.value)} placeholder="JJ/MM/AAAA" className={fieldCls} /></label>
        <Btn variant="secondary" onClick={refresh}>Filtrer</Btn>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Facturé — comptabilité d'engagement (dès émission, compte {etat?.compteTva ?? "4434"})</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["Total HT", etat?.facture.totaux.montantHT],
            ["TVA", etat?.facture.totaux.montantTva],
            ["TPS", etat?.facture.totaux.montantTps],
            ["CSS", etat?.facture.totaux.montantCss],
            ["Total TTC", etat?.facture.totaux.montantTTC],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-card border border-border rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="text-[15px] font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(Number(val) || 0)}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Encaissé — trésorerie réelle (factures réglées uniquement)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["Total HT", etat?.encaisse.totaux.montantHT],
            ["TVA", etat?.encaisse.totaux.montantTva],
            ["TPS", etat?.encaisse.totaux.montantTps],
            ["CSS", etat?.encaisse.totaux.montantCss],
            ["Total TTC", etat?.encaisse.totaux.montantTTC],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-card border border-border rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="text-[13px] font-semibold text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(Number(val) || 0)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["N°", "Société", "Émise le", "Statut", "HT", "TVA", "TPS", "CSS", "TTC"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etat?.facture.lignes.map((l) => (
              <tr key={l.numero} className="border-b border-border/50">
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.numero}</td>
                <td className="px-3 py-2.5 font-semibold text-foreground text-sm">{l.societeNom}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.date}</td>
                <td className="px-3 py-2.5"><Badge variant={statutVariant(l.statut)}>{l.statut === "Emise" ? "Émise" : "Payée"}</Badge></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(l.montantHT)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.tauxTva ? fmt(l.montantTva) : "—"}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.tauxTps ? fmt(l.montantTps) : "—"}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.tauxCss ? fmt(l.montantCss) : "—"}</td>
                <td className="px-3 py-2.5 text-foreground font-semibold">{fmt(l.montantTTC)}</td>
              </tr>
            ))}
            {etat?.facture.lignes.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucune facture sur cette période.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OngletJournal() {
  const [journal, setJournal] = useState<JournalOhada | null>(null);
  useEffect(() => { getJournalOhada().then(setJournal); }, []);

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2">
        Écritures en partie double (plan comptable OHADA) — comptes {journal?.plan.clients} Clients, {journal?.plan.ventes} Services vendus, {journal?.plan.tva} TVA facturée, {journal?.plan.css} autres taxes (CSS), {journal?.plan.tps} RRR accordés (TPS), {journal?.plan.banque} Banques. Codification des taxes propres à ce projet (TPS/CSS) à faire valider par l'expert-comptable de chaque société.
      </p>
      <div className="space-y-2">
        {journal?.ecritures.map((e, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-foreground">{e.piece} — {e.libelle}</span>
              <span className="text-[11px] text-muted-foreground">{e.date}</span>
            </div>
            <table className="w-full text-[12.5px]">
              <tbody>
                {e.lignes.map((l, j) => (
                  <tr key={j} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-1.5 text-muted-foreground w-16" style={{ fontFamily: "'DM Mono', monospace" }}>{l.compte}</td>
                    <td className="px-2 py-1.5 text-foreground">{l.libelleCompte}</td>
                    <td className="px-2 py-1.5 text-right w-32" style={{ fontFamily: "'DM Mono', monospace" }}>{l.debit ? fmt(l.debit) : ""}</td>
                    <td className="px-2 py-1.5 text-right w-32 text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{l.credit ? fmt(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {journal?.ecritures.length === 0 && <p className="text-center text-muted-foreground text-sm py-10">Aucune écriture.</p>}
      </div>
    </div>
  );
}

function OngletBalanceGenerale() {
  const [balance, setBalance] = useState<BalanceOhada | null>(null);
  useEffect(() => { getBalanceOhada().then(setBalance); }, []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {["Compte", "Libellé", "Débit", "Crédit", "Solde"].map((h) => (
              <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {balance?.comptes.map((c) => (
            <tr key={c.compte} className="border-b border-border/50">
              <td className="px-3 py-2.5 text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{c.compte}</td>
              <td className="px-3 py-2.5 text-sm text-foreground">{c.libelle}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(c.debit)}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(c.credit)}</td>
              <td className="px-3 py-2.5 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(Math.abs(c.solde))} {c.solde >= 0 ? "D" : "C"}</td>
            </tr>
          ))}
        </tbody>
        {balance && (
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/30">
              <td colSpan={2} className="px-3 py-2.5 text-right font-semibold text-foreground text-sm">Totaux</td>
              <td className="px-3 py-2.5 font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(balance.totalDebit)}</td>
              <td className="px-3 py-2.5 font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(balance.totalCredit)}</td>
              <td className="px-3 py-2.5">{balance.totalDebit === balance.totalCredit ? <Badge variant="success">Équilibrée</Badge> : <Badge variant="danger">Déséquilibrée</Badge>}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function OngletCompteDeResultat() {
  const [cr, setCr] = useState<CompteDeResultat | null>(null);
  useEffect(() => { getCompteDeResultat().then(setCr); }, []);
  if (!cr) return null;

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-[11.5px] text-muted-foreground bg-secondary/30 border border-border rounded-lg px-3 py-2">
        Reflète uniquement l'activité de facturation de la plateforme envers ses sociétés clientes — aucune charge d'exploitation (salaires, loyers...) n'est suivie dans cette application. Le résultat ci-dessous est donc un chiffre d'affaires net, pas un résultat d'entreprise complet.
      </p>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-secondary/20"><h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Produits</h3></div>
        <div className="p-4 space-y-1.5 text-[13px]">
          {cr.produits.map((p) => <div key={p.compte} className="flex justify-between"><span className="text-foreground">{p.libelle}</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(p.montant)}</span></div>)}
          {cr.reductionsProduits.map((p) => <div key={p.compte} className="flex justify-between text-muted-foreground"><span>− {p.libelle}</span><span style={{ fontFamily: "'DM Mono', monospace" }}>− {fmt(p.montant)}</span></div>)}
          <div className="flex justify-between pt-1.5 border-t border-border font-semibold"><span>Chiffre d'affaires net</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(cr.chiffreAffairesNet)}</span></div>
        </div>
        <div className="px-4 py-2.5 border-t border-b border-border bg-secondary/20"><h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Charges d'exploitation</h3></div>
        <div className="p-4 text-[13px] text-muted-foreground">Non suivies dans cette application — {fmt(cr.chargesExploitation)}</div>
        <div className="px-4 py-3 bg-primary/5 border-t border-border flex justify-between items-center">
          <span className="font-bold text-foreground">Résultat net de l'exercice</span>
          <span className="text-lg font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(cr.resultatNet)}</span>
        </div>
      </div>
    </div>
  );
}

function OngletBilan() {
  const [bilan, setBilan] = useState<Bilan | null>(null);
  useEffect(() => { getBilan().then(setBilan); }, []);
  if (!bilan) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/20"><h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Actif</h3></div>
          <div className="p-4 space-y-1.5 text-[13px]">
            {bilan.actif.map((a) => <div key={a.compte} className="flex justify-between"><span className="text-foreground">{a.libelle}</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(a.montant)}</span></div>)}
            <div className="flex justify-between pt-1.5 border-t border-border font-bold"><span>Total Actif</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(bilan.totalActif)}</span></div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/20"><h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Passif</h3></div>
          <div className="p-4 space-y-1.5 text-[13px]">
            {bilan.passif.map((p) => <div key={p.compte} className="flex justify-between"><span className="text-foreground">{p.libelle}</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(p.montant)}</span></div>)}
            <div className="flex justify-between pt-1.5 border-t border-border font-bold"><span>Total Passif</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(bilan.totalPassif)}</span></div>
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        {bilan.equilibre ? <Badge variant="success">Bilan équilibré (Actif = Passif)</Badge> : <Badge variant="danger">Bilan déséquilibré</Badge>}
      </div>
      <p className="text-[11px] text-muted-foreground text-center max-w-lg mx-auto">Reflète uniquement l'activité de facturation de la plateforme (créances clients, trésorerie encaissée, dettes fiscales) — pas un bilan d'entreprise complet (aucun actif immobilisé ni dette fournisseur suivis ici).</p>
    </div>
  );
}

function OngletGrandLivre({ societes }: { societes: Societe[] }) {
  const [societeId, setSocieteId] = useState("");
  const [livre, setLivre] = useState<GrandLivre | null>(null);

  useEffect(() => {
    if (!societeId) { setLivre(null); return; }
    getGrandLivre(societeId).then(setLivre);
  }, [societeId]);

  return (
    <div className="space-y-4">
      <label className="block max-w-sm"><div className={labelCls}>Société</div>
        <Combobox
          options={societes}
          value={societes.find((s) => s.id === societeId) ?? null}
          onChange={(s) => setSocieteId(s?.id ?? "")}
          getLabel={(s) => s.nom}
          getId={(s) => s.id}
          placeholder="Choisir une société…"
        />
      </label>
      {!societeId && <p className="text-[12.5px] text-muted-foreground text-center py-10">Choisissez une société pour voir son relevé de compte.</p>}
      {societeId && livre && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Date", "Libellé", "Débit", "Crédit", "Solde"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livre.mouvements.map((m, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.date}</td>
                  <td className="px-3 py-2.5 text-foreground text-sm">{m.libelle}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.debit ? fmt(m.debit) : "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-emerald-600">{m.credit ? fmt(m.credit) : "—"}</td>
                  <td className="px-3 py-2.5 text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(m.solde)}</td>
                </tr>
              ))}
              {livre.mouvements.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">Aucun mouvement.</td></tr>}
            </tbody>
            {livre.mouvements.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/30">
                  <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-foreground text-sm">Solde dû</td>
                  <td className="px-3 py-2.5 font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(livre.soldeFinal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// Lettrage du compte 411 (2026-09) — voir demande utilisateur : "il faut
// que l'outil IA puisse également faire un vrai lettrage de compte" puis
// "fais également remonter les informations ici... les informations
// doivent être uniques." Un mouvement (facture ou règlement) reçoit une
// même lettre que sa contrepartie exacte ; ce qui reste sans lettre est
// soit un impayé réel, soit un rapprochement à faire manuellement.
function OngletLettrage() {
  const [donnees, setDonnees] = useState<LettrageSociete[] | null>(null);
  const [societeOuverte, setSocieteOuverte] = useState<string | null>(null);

  useEffect(() => { getLettrageClients().then(setDonnees); }, []);

  if (!donnees) return <p className="text-[12.5px] text-muted-foreground text-center py-10">Chargement…</p>;

  const totalNonLettre = donnees.reduce((s, g) => s + Math.abs(g.soldeNonLettre), 0);
  const nbIncomplets = donnees.filter((g) => !g.lettrageComplet).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Sociétés suivies" value={String(donnees.length)} icon={ArrowLeftRight} />
        <StatCard title="Comptes non soldés" value={String(nbIncomplets)} icon={AlertTriangle} />
        <StatCard title="Solde non lettré (total)" value={fmt(totalNonLettre)} icon={Wallet} />
      </div>

      {donnees.length === 0 && <p className="text-[12.5px] text-muted-foreground text-center py-10">Aucune facture émise pour l'instant.</p>}

      <div className="space-y-2">
        {donnees.map((g) => {
          const ouvert = societeOuverte === g.societeId;
          return (
            <div key={g.societeId} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setSocieteOuverte(ouvert ? null : g.societeId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-foreground text-sm">{g.societeNom}</span>
                  <Badge variant={g.lettrageComplet ? "success" : "warning"}>
                    {g.lettrageComplet ? "Compte soldé" : "Solde ouvert"}
                  </Badge>
                </div>
                <span className="text-sm font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
                  <span className={g.soldeNonLettre > 0 ? "text-amber-600" : g.soldeNonLettre < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                    {fmt(g.soldeNonLettre)}
                  </span>
                </span>
              </button>
              {ouvert && (
                <table className="w-full text-sm border-t border-border">
                  <thead>
                    <tr className="border-b border-border">
                      {["Date", "Libellé", "Montant", "Lettre"].map((h) => (
                        <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.mouvements.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.date}</td>
                        <td className="px-3 py-2.5 text-foreground text-sm">{m.libelle}</td>
                        <td className="px-3 py-2.5 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
                          <span className={m.montant > 0 ? "text-foreground" : "text-emerald-600"}>{fmt(m.montant)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {m.lettre ? <Badge variant="neutral">{m.lettre}</Badge> : <span className="text-xs text-amber-600 font-medium">Non lettré</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Comptabilité & Facturation plateforme (2026-09) — voir demande
// utilisateur : "il doit avoir son écran de comptabilité complète... un
// module complet de comptabilité avec tous les états... un écran de
// facturation afin de gérer... les frais d'installation et... le paiement
// de licence." Aucune passerelle de paiement branchée — chaque règlement
// est constaté manuellement (même principe que EncaissementPrime/
// QuittanceLibre côté métier des sociétés).
export default function SuperAdminFacturationView() {
  const [onglet, setOnglet] = useState<"factures" | "balance" | "taxes" | "grandLivre" | "lettrage" | "journal" | "balanceGenerale" | "compteDeResultat" | "bilan">("factures");
  const [resume, setResume] = useState<ResumeFacturation | null>(null);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [showGenerer, setShowGenerer] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    getResumeFacturation().then(setResume);
    getSocietes().then(setSocietes);
    setRefreshKey((k) => k + 1);
  };
  useEffect(refresh, []);

  const tendance = resume?.tendanceMensuelle.map((t) => ({ mois: `${MOIS_LABELS[t.mois.slice(5)]} ${t.mois.slice(2, 4)}`, montant: t.montant })) ?? [];

  return (
    <div className="p-6">
      <ModuleHeader
        title="Comptabilité & Facturation" subtitle="Revenus de la plateforme — installation et abonnements des sociétés clientes" icon={Receipt}
        actions={<Btn variant="primary" onClick={() => setShowGenerer(true)}><Plus className="w-4 h-4" />Générer une facture</Btn>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Total facturé" value={resume ? fmt(resume.totalFacture) : "…"} icon={Receipt} />
        <StatCard title="Encaissé" value={resume ? fmt(resume.totalEncaisse) : "…"} icon={Wallet} accent="bg-emerald-500" />
        <StatCard title="Impayé" value={resume ? fmt(resume.totalImpaye) : "…"} icon={Clock} accent={resume && resume.totalImpaye > 0 ? "bg-amber-500" : undefined} />
        <StatCard title="En retard" value={resume ? fmt(resume.totalEnRetard) : "…"} icon={AlertTriangle} accent={resume && resume.totalEnRetard > 0 ? "bg-red-500" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-primary" /><h3 className="font-semibold text-foreground text-sm">Encaissements — 12 derniers mois</h3></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tendance}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [fmt(v)]} />
              <Area type="monotone" dataKey="montant" stroke="var(--primary)" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-foreground text-sm mb-3">Taxes collectées</h3>
          <div className="space-y-2.5">
            {[
              ["TVA", resume?.totalTvaCollectee],
              ["TPS", resume?.totalTpsCollectee],
              ["CSS", resume?.totalCssCollectee],
            ].map(([label, val]) => (
              <div key={label as string} className="flex justify-between items-center text-[12.5px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(Number(val) || 0)}</span>
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-foreground text-sm mt-4 mb-2">Par société</h3>
          <div className="space-y-2 max-h-[120px] overflow-y-auto">
            {resume?.parSociete.map((s) => (
              <div key={s.societeId} className="text-[12px]">
                <div className="flex justify-between"><span className="text-foreground font-medium">{s.nom}</span><span className="text-muted-foreground">{fmt(s.facture)}</span></div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500" style={{ width: `${s.facture ? (s.encaisse / s.facture) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {resume?.parSociete.length === 0 && <p className="text-[12px] text-muted-foreground text-center py-4">Aucune facture émise.</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border mb-4 flex-wrap">
        {([
          ["factures", "Journal des factures", ScrollText],
          ["balance", "Balance âgée", Scale],
          ["taxes", "État des taxes", Receipt],
          ["grandLivre", "Grand livre (411)", BookOpen],
          ["lettrage", "Lettrage (411)", ArrowLeftRight],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id} type="button" onClick={() => setOnglet(id)}
            className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${onglet === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {([
          ["journal", "Journal OHADA", BookText],
          ["balanceGenerale", "Balance générale", Table2],
          ["compteDeResultat", "Compte de résultat", TrendingDown],
          ["bilan", "Bilan", Landmark],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id} type="button" onClick={() => setOnglet(id)}
            className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${onglet === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {onglet === "factures" && <OngletFactures societes={societes} refreshKey={refreshKey} onChanged={refresh} />}
      {onglet === "balance" && <OngletBalanceAgee />}
      {onglet === "taxes" && <OngletTaxes />}
      {onglet === "grandLivre" && <OngletGrandLivre societes={societes} />}
      {onglet === "lettrage" && <OngletLettrage />}
      {onglet === "journal" && <OngletJournal />}
      {onglet === "balanceGenerale" && <OngletBalanceGenerale />}
      {onglet === "compteDeResultat" && <OngletCompteDeResultat />}
      {onglet === "bilan" && <OngletBilan />}

      {showGenerer && <GenererFactureModal societes={societes} onClose={() => setShowGenerer(false)} onSaved={refresh} />}
    </div>
  );
}

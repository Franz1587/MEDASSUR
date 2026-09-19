import { useEffect, useState } from "react";
import { Coins, Save, Users2, IdCard, Tag, Plus, Trash2, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { viewLabels } from "@/layout/navConfig";
import { GROUPES_MODULES } from "@/auth/moduleGroups";
import { fmt } from "@/lib/format";
import {
  getModulesPrix, upsertModulePrix, getTauxChange, upsertTauxChange,
  getParametresFacturation, updateParametresFacturation,
  getRubriquesFacturation, creerRubriqueFacturation, modifierRubriqueFacturation, supprimerRubriqueFacturation,
} from "@/services/societes.service";
import type { ModulePrix, TauxChange, Devise, ParametresFacturationPlateforme, RubriqueFacturation } from "@/types/societes";
import { DEVISES, LICENCE_ANNUELLE_MINIMUM } from "@/types/societes";

const fieldCls = "w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-[12.5px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Tarification par module + taux de change (2026-09) — voir demande
// utilisateur : "l'application doit pouvoir évaluer un coût pour chaque
// fonctionnalité (rendre paramétrable) afin que l'option d'abonnement
// s'enrichisse en fonction des fonctionnalités cochées. En fonction des
// taux, faire une correspondance en euro/dollars et convertir en FCFA
// (XAF)." Chaque prix module (EUR/USD) est converti ici en FCFA — c'est
// cette somme que le picker de modules (Societes.tsx) affiche en direct.
export default function SuperAdminTarificationView() {
  const [prix, setPrix] = useState<ModulePrix[]>([]);
  const [taux, setTaux] = useState<TauxChange[]>([]);
  const [draftPrix, setDraftPrix] = useState<Record<string, { prix: number; devise: Devise }>>({});
  const [draftTaux, setDraftTaux] = useState<Record<string, number>>({});
  const [savingModule, setSavingModule] = useState<string | null>(null);
  const [savingTaux, setSavingTaux] = useState<string | null>(null);
  // Tarification par personne assurée (2026-09) — voir demande
  // utilisateur : "en plus de la tarification liée aux fonctionnalités, il
  // y a la licence annuelle par assuré... on facture la carte par assuré
  // et ayant droit."
  const [parametres, setParametres] = useState<ParametresFacturationPlateforme | null>(null);
  const [draftLicence, setDraftLicence] = useState(LICENCE_ANNUELLE_MINIMUM);
  const [draftCarte, setDraftCarte] = useState(0);
  const [savingParametres, setSavingParametres] = useState(false);
  const [erreurLicence, setErreurLicence] = useState<string | null>(null);
  // Rubriques de facturation (2026-09) — voir demande utilisateur : "le
  // type de facture n'est pas les rubriques de facture. les rubriques font
  // référence aux différentes lignes de facturation (installation,
  // licence, carte, récupération de données...)" — gérables librement ici.
  const [rubriques, setRubriques] = useState<RubriqueFacturation[]>([]);
  const [nouvelleRubrique, setNouvelleRubrique] = useState({ libelle: "", prixDefaut: "" });
  const [savingRubrique, setSavingRubrique] = useState(false);

  const refresh = () => {
    getModulesPrix().then((p) => {
      setPrix(p);
      setDraftPrix(Object.fromEntries(p.map((m) => [m.module, { prix: m.prix, devise: m.devise }])));
    });
    getTauxChange().then((t) => {
      setTaux(t);
      setDraftTaux(Object.fromEntries(t.map((x) => [x.devise, x.tauxVersXaf])));
    });
    getParametresFacturation().then((p) => {
      setParametres(p);
      setDraftLicence(p.licenceAnnuellePersonne);
      setDraftCarte(p.carteParPersonne);
    });
    getRubriquesFacturation().then(setRubriques);
  };
  useEffect(refresh, []);

  const handleCreerRubrique = async () => {
    if (!nouvelleRubrique.libelle.trim()) return;
    const code = nouvelleRubrique.libelle.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    try {
      setSavingRubrique(true);
      await creerRubriqueFacturation({ libelle: nouvelleRubrique.libelle.trim(), code, prixDefaut: nouvelleRubrique.prixDefaut ? Number(nouvelleRubrique.prixDefaut) : undefined });
      toast.success("Rubrique créée.");
      setNouvelleRubrique({ libelle: "", prixDefaut: "" });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSavingRubrique(false);
    }
  };

  const handleToggleRubrique = async (r: RubriqueFacturation) => {
    try {
      await modifierRubriqueFacturation(r.code, { actif: !r.actif });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    }
  };

  const handleSupprimerRubrique = async (r: RubriqueFacturation) => {
    if (!window.confirm(`Supprimer la rubrique "${r.libelle}" ?`)) return;
    try {
      await supprimerRubriqueFacturation(r.code);
      toast.success("Rubrique supprimée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleSaveParametres = async () => {
    if (draftLicence < LICENCE_ANNUELLE_MINIMUM) {
      setErreurLicence(`La licence annuelle ne peut pas descendre sous ${fmt(LICENCE_ANNUELLE_MINIMUM)}.`);
      return;
    }
    try {
      setSavingParametres(true);
      setErreurLicence(null);
      await updateParametresFacturation({ licenceAnnuellePersonne: draftLicence, carteParPersonne: draftCarte });
      toast.success("Tarification par personne mise à jour.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingParametres(false);
    }
  };

  const prixParModule = new Map(prix.map((p) => [p.module, p]));
  const tauxParDevise = new Map(taux.map((t) => [t.devise, t.tauxVersXaf]));

  const convertiEnXaf = (module: string): number => {
    const d = draftPrix[module];
    if (!d) return 0;
    const t = draftTaux[d.devise] ?? tauxParDevise.get(d.devise) ?? 1;
    return Math.round(d.prix * t);
  };

  const handleSaveModule = async (module: string) => {
    const d = draftPrix[module];
    if (!d) return;
    try {
      setSavingModule(module);
      await upsertModulePrix(module, d.prix, d.devise);
      toast.success(`Tarif de "${viewLabels[module as keyof typeof viewLabels] ?? module}" enregistré.`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingModule(null);
    }
  };

  const handleSaveTaux = async (devise: Devise) => {
    const v = draftTaux[devise];
    if (!v) return;
    try {
      setSavingTaux(devise);
      await upsertTauxChange(devise, v);
      toast.success(`Taux ${devise} → XAF mis à jour.`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingTaux(null);
    }
  };

  const totalTousModules = GROUPES_MODULES.flatMap((g) => g.views).reduce((s, v) => s + convertiEnXaf(v), 0);

  return (
    <div className="p-6">
      <ModuleHeader title="Tarification" subtitle="Coût par fonctionnalité et taux de change — alimente le calcul automatique des abonnements" icon={Coins} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">
          {GROUPES_MODULES.map((g) => (
            <div key={g.label} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-secondary/20">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="px-4 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fonctionnalité</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prix/mois</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Devise</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">≈ FCFA/mois</th>
                    <th className="w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.views.map((v) => {
                    const d = draftPrix[v] ?? { prix: 0, devise: "EUR" as Devise };
                    const modifie = prixParModule.get(v) ? (prixParModule.get(v)!.prix !== d.prix || prixParModule.get(v)!.devise !== d.devise) : d.prix !== 0;
                    return (
                      <tr key={v} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 text-[12.5px] text-foreground">{viewLabels[v]}</td>
                        <td className="px-2 py-2 w-24">
                          <input type="number" min={0} step="0.01" value={d.prix} onChange={(e) => setDraftPrix((s) => ({ ...s, [v]: { ...d, prix: Number(e.target.value) } }))} className={fieldCls} />
                        </td>
                        <td className="px-2 py-2 w-20">
                          <select value={d.devise} onChange={(e) => setDraftPrix((s) => ({ ...s, [v]: { ...d, devise: e.target.value as Devise } }))} className={fieldCls}>
                            {DEVISES.map((dv) => <option key={dv} value={dv}>{dv}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right text-[12px] text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>≈ {fmt(convertiEnXaf(v))}</td>
                        <td className="px-2 py-2 w-9">
                          {modifie && (
                            <button type="button" onClick={() => handleSaveModule(v)} disabled={savingModule === v} title="Enregistrer" className="p-1.5 rounded hover:bg-secondary text-primary">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="space-y-4 h-fit lg:sticky lg:top-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-1.5"><Users2 className="w-4 h-4 text-primary" />Tarification par personne</h3>
            {erreurLicence && <p className="text-[11.5px] text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-2.5 py-1.5 mb-3">{erreurLicence}</p>}
            <div className="space-y-3">
              <div>
                <div className={labelCls}>Licence annuelle / personne (assuré + ayants droit)</div>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={LICENCE_ANNUELLE_MINIMUM} value={draftLicence} onChange={(e) => setDraftLicence(Number(e.target.value))} className={fieldCls} />
                  <span className="text-[12px] text-muted-foreground flex-shrink-0">FCFA/an</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1">Minimum {fmt(LICENCE_ANNUELLE_MINIMUM)}/an — jamais en-deçà. Facturée au prorata du cycle choisi par chaque société (voir écran Facturation).</p>
              </div>
              <div>
                <div className={labelCls}><IdCard className="w-3 h-3 inline mr-1" />Frais de carte / personne</div>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} value={draftCarte} onChange={(e) => setDraftCarte(Number(e.target.value))} className={fieldCls} />
                  <span className="text-[12px] text-muted-foreground flex-shrink-0">FCFA</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1">Facturé une fois par carte émise (type "Cartes" à l'écran Facturation), librement paramétrable.</p>
              </div>
              <button
                type="button" onClick={handleSaveParametres} disabled={savingParametres || (parametres != null && draftLicence === parametres.licenceAnnuellePersonne && draftCarte === parametres.carteParPersonne)}
                className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />Enregistrer
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground text-sm mb-3">Taux de change → FCFA</h3>
            <div className="space-y-3">
              {DEVISES.map((dv) => (
                <div key={dv}>
                  <div className={labelCls}>1 {dv} =</div>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={0} step="0.0001" value={draftTaux[dv] ?? ""} onChange={(e) => setDraftTaux((s) => ({ ...s, [dv]: Number(e.target.value) }))} className={fieldCls} />
                    <span className="text-[12px] text-muted-foreground flex-shrink-0">FCFA</span>
                    <button type="button" onClick={() => handleSaveTaux(dv)} disabled={savingTaux === dv} className="p-1.5 rounded hover:bg-secondary text-primary flex-shrink-0"><Save className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              <p className="text-[10.5px] text-muted-foreground pt-1">EUR est légalement fixe pour le XAF (parité BEAC 1 € = 655,957 F). USD flotte réellement — aucun flux de cours en direct n'est branché sur ce projet : taux à actualiser manuellement.</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground">Somme MENSUELLE si TOUS les modules étaient souscrits</p>
            <p className="text-xl font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(totalTousModules)}<span className="text-[13px] font-normal text-muted-foreground">/mois</span></p>
            <p className="text-[10.5px] text-muted-foreground mt-1">Soit {fmt(totalTousModules * 12)}/an. Repère de plafond — le prix réel d'une société dépend des modules qu'elle a effectivement souscrits ET de son cycle de facturation (voir écran Sociétés).</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mt-5">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5"><Tag className="w-4 h-4 text-primary" />Rubriques de facturation ({rubriques.length})</h3>
        </div>
        <div className="p-4 flex flex-wrap items-end gap-2 border-b border-border bg-secondary/10">
          <label className="block"><div className={labelCls}>Nouvelle rubrique</div><input value={nouvelleRubrique.libelle} onChange={(e) => setNouvelleRubrique((v) => ({ ...v, libelle: e.target.value }))} placeholder="ex. Récupération de données" className={fieldCls} style={{ width: 240 }} /></label>
          <label className="block"><div className={labelCls}>Prix par défaut (FCFA)</div><input type="number" min={0} value={nouvelleRubrique.prixDefaut} onChange={(e) => setNouvelleRubrique((v) => ({ ...v, prixDefaut: e.target.value }))} className={fieldCls} style={{ width: 140 }} /></label>
          <Btn variant="primary" onClick={handleCreerRubrique} disabled={savingRubrique || !nouvelleRubrique.libelle.trim()}><Plus className="w-4 h-4" />Ajouter</Btn>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Rubrique", "Code", "Prix par défaut", "Statut", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rubriques.map((r) => (
              <tr key={r.code} className={`border-b border-border/50 last:border-0 ${!r.actif ? "opacity-50" : ""}`}>
                <td className="px-4 py-2.5 font-medium text-foreground text-[13px]">{r.libelle}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{r.code}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.prixDefaut != null ? fmt(r.prixDefaut) : "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.actif ? "Active" : "Désactivée"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button type="button" onClick={() => handleToggleRubrique(r)} title={r.actif ? "Désactiver" : "Réactiver"} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      {r.actif ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => handleSupprimerRubrique(r)} title="Supprimer" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rubriques.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">Aucune rubrique.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Search, Pencil, ChevronDown, ChevronUp, IdCard } from "lucide-react";
import { toast } from "sonner";
import { DateInput } from "@/components/shared/DateInput";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { calculerAge } from "@/lib/age";
import { getAssuresSante, exportPopulationCsv, updateAssure, type UpdateAssureInput } from "@/services/sante.service";
import { openPopulationExport, genererCartesEnMasse } from "@/services/documents.service";
import { mouvementPopulation, getPopulationHistorique, type AjoutPersonneInput } from "@/services/contrats.service";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const STATUT_BADGE: Record<string, BadgeVariant> = { Actif: "success", Suspendu: "warning", Radié: "danger" };

function todayFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function emptyAjout(): AjoutPersonneInput {
  return { nom: "", prenom: "", dateNaissance: "", typeAssure: "AS", scolarise: false, beneficiaires: 0, cotisation: 0 };
}

function emptyEdit(a: AssureSante): UpdateAssureInput {
  return {
    nom: a.nom, prenom: a.prenom ?? "",
    telephone: !a.familleId ? (a.telephone ?? "") : undefined,
    dateNaissance: a.dateNaissance ?? "",
    statutMatrimonial: a.statutMatrimonial as UpdateAssureInput["statutMatrimonial"],
    sexe: a.sexe as UpdateAssureInput["sexe"],
    scolarise: a.scolarise ?? false,
    adresse: a.adresse ?? "",
    lieuNaissance: a.lieuNaissance ?? "",
    email: a.email ?? "",
    telephoneFixe: a.telephoneFixe ?? "",
  };
}

// Limite d'âge applicable à une personne, dans le même esprit que le
// helper backend age-limite.util.ts (calcul dupliqué côté client
// uniquement pour l'affichage d'un badge d'alerte — le refus effectif à la
// saisie reste vérifié côté serveur, seule source de vérité).
function limiteApplicable(contrat: Contrat, a: AssureSante): number | null {
  const t = (a.typeAssure ?? "").toUpperCase();
  if (t === "AS" || t === "CJ") return contrat.limiteAgeAdulte ?? null;
  if (t === "EF") return a.scolarise && contrat.limiteAgeEnfantScolarise != null ? contrat.limiteAgeEnfantScolarise : contrat.limiteAgeEnfant ?? null;
  return null;
}

function correspond(a: AssureSante, terme: string): boolean {
  const t = terme.trim().toLowerCase();
  if (!t) return true;
  return `${a.nom} ${a.prenom ?? ""}`.toLowerCase().includes(t) || (a.matricule ?? "").toLowerCase().includes(t);
}

interface Props {
  contrat: Contrat;
  onUpdated?: (contrat: Contrat) => void;
}

// Panneau population d'un contrat DÉJÀ créé — partagé entre la modale
// "Gérer les assurés" (GestionPopulationModal, déclenchée depuis la liste
// des contrats) et l'onglet Population de la fiche contrat en édition, pour
// ne jamais faire diverger les deux : recherche, regroupement par famille,
// consultation/édition d'une fiche, sélection groupée + retrait en masse,
// export CSV/PDF/Excel/Word, génération de cartes, ajout de personnes.
export default function PopulationPanel({ contrat, onUpdated }: Props) {
  const [population, setPopulation] = useState<AssureSante[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [retraitIds, setRetraitIds] = useState<string[]>([]);
  const [ajouts, setAjouts] = useState<AjoutPersonneInput[]>([]);
  const [nouvelAjout, setNouvelAjout] = useState<AjoutPersonneInput>(emptyAjout());
  const [dateEffet, setDateEffet] = useState(todayFr());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyCartes, setBusyCartes] = useState(false);

  // Filtres d'export — statut (Tous/Actif/Radié) et période (du/au,
  // optionnels). PDF/Excel/Word reconstituent la population telle qu'elle
  // était sur la période demandée (voir backend reconstituerPopulation) ;
  // le CSV, 100% client, ne filtre lui que par statut sur la population
  // actuelle (voir exportPopulationCsv).
  const [filtreStatut, setFiltreStatut] = useState<"tous" | "Actif" | "Radié">("tous");
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");

  // Vue historique — résultat du bouton "Rechercher" (reconstitution de la
  // population sur la période/statut demandés, voir getPopulationHistorique).
  // null = on affiche la population actuelle ; non-null = vue en lecture
  // seule (ajout/retrait/édition n'ont de sens que sur la population réelle).
  const [vueHistorique, setVueHistorique] = useState<AssureSante[] | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateAssureInput>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const charger = () => {
    // Tout le monde est affiché (y compris Suspendu/Radié) — un contrat
    // repris des années plus tard peut avoir une population historique
    // qu'il faut pouvoir consulter/exporter sans la masquer.
    getAssuresSante()
      .then((all) => setPopulation(all.filter((a) => a.police === contrat.id)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrat.id]);

  const populationAffichee = vueHistorique ?? population;

  const familles = useMemo(() => {
    const racines = populationAffichee.filter((a) => !a.familleId).sort((x, y) => x.nom.localeCompare(y.nom));
    return racines.map((racine) => ({
      racine,
      membres: populationAffichee.filter((a) => a.familleId === racine.id).sort((x, y) => (x.typeAssure ?? "").localeCompare(y.typeAssure ?? "")),
    }));
  }, [populationAffichee]);

  const famillesFiltrees = useMemo(() => {
    if (!recherche.trim()) return familles;
    return familles.filter((f) => correspond(f.racine, recherche) || f.membres.some((m) => correspond(m, recherche)));
  }, [familles, recherche]);

  const radiables = populationAffichee.filter((a) => a.statut !== "Radié");
  const toutSelectionne = radiables.length > 0 && radiables.every((a) => retraitIds.includes(a.id));
  const toggleTout = () => setRetraitIds(toutSelectionne ? [] : radiables.map((a) => a.id));
  const toggleRetrait = (assureId: string) => {
    setRetraitIds((ids) => (ids.includes(assureId) ? ids.filter((id) => id !== assureId) : [...ids, assureId]));
  };

  const ouvrirDetail = (a: AssureSante) => {
    if (detailId === a.id) { setDetailId(null); return; }
    setDetailId(a.id);
    setEditForm(emptyEdit(a));
    setEditError(null);
  };

  const enregistrerDetail = async (a: AssureSante) => {
    try {
      setEditSubmitting(true);
      setEditError(null);
      await updateAssure(a.id, editForm);
      toast.success("Fiche mise à jour.");
      setDetailId(null);
      charger();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const rechercherPeriode = async () => {
    try {
      setRechercheEnCours(true);
      const resultat = await getPopulationHistorique(contrat.id, { statut: filtreStatut, du: filtreDu || undefined, au: filtreAu || undefined });
      setVueHistorique(resultat);
      setRetraitIds([]);
      setDetailId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de recherche.");
    } finally {
      setRechercheEnCours(false);
    }
  };

  const revenirALaPopulationActuelle = () => {
    setVueHistorique(null);
    setRetraitIds([]);
    setDetailId(null);
  };

  const genererCartes = async () => {
    if (!window.confirm(`Générer les cartes de tous les assurés actifs de ${contrat.numeroPolice || contrat.id} (${population.length} personne(s)) ?`)) return;
    try {
      setBusyCartes(true);
      await genererCartesEnMasse({ contratId: contrat.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de génération des cartes.");
    } finally {
      setBusyCartes(false);
    }
  };

  const addToPending = () => {
    if (!nouvelAjout.nom.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    setAjouts((rows) => [...rows, nouvelAjout]);
    setNouvelAjout(emptyAjout());
  };

  const removePending = (index: number) => {
    setAjouts((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (ajouts.length === 0 && retraitIds.length === 0) {
      setError("Ajoutez ou sélectionnez au moins une personne à retirer.");
      return;
    }
    if (!dateEffet.trim()) {
      setError("La date d'effet du mouvement est obligatoire.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const { contrat: updated, avenants } = await mouvementPopulation(contrat.id, { ajouts, retraitIds, dateEffet });
      const parts = [
        avenants.find((a) => a.type === "Incorporation") ? `Incorporation (${ajouts.length} personne(s))` : null,
        avenants.find((a) => a.type === "Retrait") ? `Retrait (${retraitIds.length} personne(s))` : null,
      ].filter(Boolean);
      toast.success(`Mouvement enregistré — ${parts.join(" + ")}. Prime mise à jour.`);
      setAjouts([]);
      setRetraitIds([]);
      onUpdated?.(updated);
      charger();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement du mouvement.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtreExport = { statut: filtreStatut, du: filtreDu || undefined, au: filtreAu || undefined };
  const exportsBoutons: { label: string; action: () => void }[] = [
    { label: "CSV", action: () => exportPopulationCsv(contrat, population, filtreStatut) },
    { label: "PDF", action: () => { openPopulationExport(contrat.id, "pdf", filtreExport).catch(() => toast.error("Export PDF impossible.")); } },
    { label: "Excel", action: () => { openPopulationExport(contrat.id, "xlsx", filtreExport).catch(() => toast.error("Export Excel impossible.")); } },
    { label: "Word", action: () => { openPopulationExport(contrat.id, "docx", filtreExport).catch(() => toast.error("Export Word impossible.")); } },
  ];

  const modeHistorique = vueHistorique !== null;

  const ligne = (a: AssureSante, indent: boolean) => {
    const marque = retraitIds.includes(a.id);
    const age = calculerAge(a.dateNaissance);
    const limite = limiteApplicable(contrat, a);
    const horsLimite = age != null && limite != null && age > limite;
    const ouverte = detailId === a.id;
    return (
      <div key={a.id} className={indent ? "border-t border-border/50" : ""}>
        <div className={`flex items-center justify-between px-3 py-2 text-[12px] gap-2 ${marque ? "bg-destructive/5" : ""} ${indent ? "pl-8" : ""}`}>
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={marque}
              disabled={modeHistorique || a.statut === "Radié"}
              onChange={() => toggleRetrait(a.id)}
              className="w-3.5 h-3.5 accent-destructive flex-shrink-0 disabled:opacity-30"
            />
            <button type="button" disabled={modeHistorique} onClick={() => ouvrirDetail(a)} className="flex items-center gap-1.5 min-w-0 hover:text-primary disabled:hover:text-foreground disabled:cursor-default">
              <span className={`truncate ${marque ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {a.nom} {a.prenom ?? ""} <span className="text-muted-foreground">({a.typeAssure ?? "—"}{age != null ? `, ${age} ans` : ""})</span>
              </span>
              {!modeHistorique && (ouverte ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <Pencil className="w-3 h-3 flex-shrink-0 opacity-50" />)}
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {horsLimite && <Badge variant="warning">Hors limite d'âge</Badge>}
            <Badge variant={STATUT_BADGE[a.statut] ?? "neutral"}>{a.statut}</Badge>
          </div>
        </div>
        {ouverte && (
          <div className={`px-3 pb-3 space-y-2.5 bg-secondary/10 ${indent ? "pl-8" : ""}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              <label className="block"><div className={labelCls}>Nom</div><input value={editForm.nom ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Prénom</div><input value={editForm.prenom ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Date de naissance</div><DateInput value={editForm.dateNaissance ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Sexe</div><select value={editForm.sexe ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, sexe: e.target.value as UpdateAssureInput["sexe"] }))} className={fieldCls}><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
              <label className="block"><div className={labelCls}>Statut marital</div><select value={editForm.statutMatrimonial ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, statutMatrimonial: e.target.value as UpdateAssureInput["statutMatrimonial"] }))} className={fieldCls}><option value="">Sélectionnez</option><option>Célibataire</option><option>Marié</option><option>Divorcé</option><option>Veuf</option></select></label>
              {!a.familleId && <label className="block"><div className={labelCls}>Téléphone (famille)</div><input value={editForm.telephone ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>}
              <label className="block"><div className={labelCls}>Email</div><input value={editForm.email ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Adresse</div><input value={editForm.adresse ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Lieu de naissance</div><input value={editForm.lieuNaissance ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, lieuNaissance: e.target.value }))} className={fieldCls} /></label>
            </div>
            {(a.typeAssure ?? "").toUpperCase() === "EF" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.scolarise ?? false} onChange={(e) => setEditForm((v) => ({ ...v, scolarise: e.target.checked }))} className="w-3.5 h-3.5 accent-primary" />
                <span className="text-[11px] text-muted-foreground">Enfant scolarisé (limite d'âge étendue du contrat)</span>
              </label>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-destructive">{editError ?? ""}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDetailId(null)} className="h-7 px-3 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={editSubmitting} onClick={() => enregistrerDetail(a)} className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] hover:opacity-90 disabled:opacity-60">
                  {editSubmitting ? "Enregistrement…" : "Enregistrer la fiche"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-[220px] flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground flex-shrink-0">Population ({populationAffichee.length})</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {radiables.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} className="w-3.5 h-3.5 accent-primary" />
                Tout sélectionner
              </label>
            )}
            <button type="button" disabled={busyCartes || population.length === 0} onClick={genererCartes} className="text-[11px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1">
              <IdCard className="w-3.5 h-3.5" />Générer les cartes du contrat
            </button>
            <div className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              {exportsBoutons.map((e) => (
                <button key={e.label} type="button" onClick={e.action} disabled={population.length === 0} className="text-[11px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline px-1">
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="relative block mb-2">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une famille, une personne, un matricule…" className={`${fieldCls} pl-9`} />
        </label>

        <div className="rounded-lg border border-border/60 bg-secondary/10 px-3 py-2.5 mb-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            Statut et période — s'appliquent à la fois à la liste ci-dessous (bouton Rechercher) et aux exports PDF/Excel/Word, qui reconstituent la population telle qu'elle était sur la période demandée. Le CSV, lui, ne filtre que par statut sur la population actuelle.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-end">
            <label className="block">
              <div className={labelCls}>Statut</div>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value as typeof filtreStatut)} className={fieldCls}>
                <option value="tous">Tous</option>
                <option value="Actif">Actif</option>
                <option value="Radié">Radié</option>
              </select>
            </label>
            <label className="block">
              <div className={labelCls}>Population du</div>
              <DateInput value={filtreDu} onChange={setFiltreDu} placeholder="Optionnel" className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>au</div>
              <DateInput value={filtreAu} onChange={setFiltreAu} placeholder="Optionnel" className={fieldCls} />
            </label>
            <button
              type="button"
              disabled={rechercheEnCours}
              onClick={rechercherPeriode}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5 justify-center"
            >
              <Search className="w-3.5 h-3.5" />{rechercheEnCours ? "Recherche…" : "Rechercher"}
            </button>
          </div>
        </div>

        {vueHistorique !== null && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 mb-3">
            <p className="text-[11px] text-foreground">
              Vue historique — {vueHistorique.length} personne(s) {filtreDu || filtreAu ? `entre le ${filtreDu || "…"} et le ${filtreAu || "…"}` : ""} {filtreStatut !== "tous" ? `(statut ${filtreStatut})` : ""}. Lecture seule — ajout/retrait/édition indisponibles sur une vue passée.
            </p>
            <button type="button" onClick={revenirALaPopulationActuelle} className="flex-shrink-0 text-[11px] text-primary hover:underline whitespace-nowrap">
              Revenir à la population actuelle
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-[12px] text-muted-foreground py-4">Chargement…</p>
        ) : population.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucun assuré sur ce contrat.</p>
        ) : famillesFiltrees.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucun résultat pour « {recherche} ».</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden max-h-[26rem] overflow-y-auto divide-y divide-border/50">
            {famillesFiltrees.map(({ racine, membres }) => (
              <div key={racine.id}>
                {ligne(racine, false)}
                {membres.map((m) => ligne(m, true))}
              </div>
            ))}
          </div>
        )}
        {retraitIds.length > 0 && (
          <p className="text-[11px] text-destructive mt-1.5">{retraitIds.length} personne(s) sélectionnée(s) pour retrait — créera un avenant Retrait à l'enregistrement.</p>
        )}
      </div>

      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Ajouter une personne</div>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.2fr_0.8fr_1fr_1fr_auto] gap-2 items-center">
          <input value={nouvelAjout.nom} onChange={(e) => setNouvelAjout((v) => ({ ...v, nom: e.target.value }))} placeholder="Nom" className={fieldCls} />
          <input value={nouvelAjout.prenom} onChange={(e) => setNouvelAjout((v) => ({ ...v, prenom: e.target.value }))} placeholder="Prénom" className={fieldCls} />
          <DateInput value={nouvelAjout.dateNaissance ?? ""} onChange={(v) => setNouvelAjout((n) => ({ ...n, dateNaissance: v }))} placeholder="Date naiss." className={fieldCls} />
          <select value={nouvelAjout.typeAssure} onChange={(e) => setNouvelAjout((v) => ({ ...v, typeAssure: e.target.value }))} className={fieldCls}>
            <option value="AS">AS</option><option value="CJ">CJ</option><option value="EF">EF</option>
          </select>
          <input type="number" value={nouvelAjout.beneficiaires} onChange={(e) => setNouvelAjout((v) => ({ ...v, beneficiaires: Number(e.target.value) }))} placeholder="Ayants droit" className={fieldCls} />
          <input type="number" value={nouvelAjout.cotisation} onChange={(e) => setNouvelAjout((v) => ({ ...v, cotisation: Number(e.target.value) }))} placeholder="Cotisation" className={fieldCls} />
          <button type="button" disabled={modeHistorique} onClick={addToPending} className="h-9 w-9 flex-shrink-0 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"><Plus className="w-4 h-4" /></button>
        </div>
        {modeHistorique && <p className="text-[11px] text-muted-foreground mt-1.5">Revenez à la population actuelle pour ajouter ou retirer des personnes.</p>}
        {nouvelAjout.typeAssure === "EF" && (
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={nouvelAjout.scolarise ?? false} onChange={(e) => setNouvelAjout((v) => ({ ...v, scolarise: e.target.checked }))} className="w-3.5 h-3.5 accent-primary" />
            <span className="text-[11px] text-muted-foreground">Enfant scolarisé (limite d'âge étendue du contrat)</span>
          </label>
        )}

        {ajouts.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {ajouts.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-[12px]">
                <span className="text-foreground">{a.nom} {a.prenom} <span className="text-muted-foreground">({a.typeAssure})</span></span>
                <button type="button" onClick={() => removePending(i)} className="h-6 w-6 rounded hover:bg-secondary text-muted-foreground hover:text-destructive inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <p className="text-[11px] text-primary">{ajouts.length} personne(s) en attente — créera un avenant Incorporation à l'enregistrement.</p>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 flex-wrap border-t border-border pt-4">
        <label className="block max-w-xs">
          <div className={labelCls}>Date d'effet du mouvement</div>
          <DateInput value={dateEffet} onChange={setDateEffet} className={fieldCls} />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-destructive">{error ?? ""}</span>
          <button type="button" disabled={submitting || modeHistorique} onClick={handleSubmit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">
            {submitting ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </div>
  );
}

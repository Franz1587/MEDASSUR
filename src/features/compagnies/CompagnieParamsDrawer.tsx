import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  updateCompagnie, deleteCompagnie,
  uploadCompagnieLogo, deleteCompagnieLogo, compagnieLogoUrl,
  replaceAccessoires, replaceSurprimesAge, replaceClausesAjustement, replaceTerritorialites, replaceTauxCouverture,
  replaceGarantiesCatalogue, getCompagnies,
} from "@/services/compagnies.service";
import { getAgences } from "@/services/agences.service";
import type { Agence } from "@/types/agences";
import { Combobox } from "@/components/shared/Combobox";
import { getContrats } from "@/services/contrats.service";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { fmtM } from "@/lib/format";
import type { Compagnie } from "@/types/compagnies";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

// Portail d'accès rapide à un contrat depuis un autre écran (2026-08, voir
// demande utilisateur : "cet interface doit être également un autre
// portail d'accès au contrat") — même mécanisme que
// CLE_AVENANT_A_OUVRIR côté Renouvellements/Avenants : on dépose l'id visé
// en sessionStorage puis on bascule la vue, l'écran Contrats se charge de
// le consommer et d'ouvrir directement la fiche.
const CLE_CONTRAT_A_OUVRIR = "medassur:open-contrat";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionCls = "text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 mt-5 first:mt-0";

const TABS = [
  { id: "general", label: "Général" },
  { id: "commission", label: "Commission" },
  { id: "papier", label: "Papier en-tête & RIB" },
  { id: "accessoires", label: "Accessoires" },
  { id: "surprimes", label: "Surprimes d'âge" },
  { id: "clauses", label: "Clauses d'ajustement" },
  { id: "baremes", label: "Barèmes de prestations" },
  { id: "garanties", label: "Garanties" },
  { id: "contrats", label: "Contrats" },
] as const;
type TabId = typeof TABS[number]["id"];

type AccessoireRow = { borneMin: number; borneMax: number | null; montant: number };
type SurprimeRow = { ageMin: number; ageMax: number | null; tauxPourcent: number };
type ClauseRow = { spMin: number; spMax: number | null; tauxAjustement: number; description: string };
type TerritorialiteRow = { libelle: string };
type TauxCouvertureRow = { tauxAmbulatoire: string; tauxHospitalisation: string };
type GarantieRow = { categorie: string; libelle: string; plafondDefaut: string; tauxStructurePriveeDefaut: string; tauxStructurePubliqueDefaut: string };

export function CompagnieLogo({ logo, taille = 48 }: { logo?: string | null; taille?: number }) {
  const url = compagnieLogoUrl(logo);
  return url
    ? <img src={url} alt="" className="rounded-xl object-contain bg-white flex-shrink-0" style={{ width: taille, height: taille }} />
    : (
      <div className="rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" style={{ width: taille, height: taille }}>
        <Building2 className="text-primary" style={{ width: taille * 0.5, height: taille * 0.5 }} />
      </div>
    );
}

// Tiroir de paramètres partagé entre l'écran Compagnies (vraies compagnies)
// et l'écran Auto-Gestion (profils auto-assureurs) — les deux réutilisent
// le même model Compagnie côté backend (voir Compagnie.clientId), donc les
// mêmes règles, les mêmes endpoints "remplace toute la liste" et le même
// écran de paramétrage, sans aucune distinction ici.
export function CompagnieParamsDrawer({ compagnie: selected, onClose, onSaved, titrePrefix = "Paramètres" }: {
  compagnie: Compagnie;
  onClose: () => void;
  onSaved: () => void;
  titrePrefix?: string;
}) {
  const { setView } = useShellNavigation();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  // Contrats de la compagnie (2026-08) — voir demande utilisateur : "on
  // doit pouvoir voir les contrats qui sont liés à la compagnie (tous les
  // contrats, selon les exercices, les contrats encore actifs... ou ceux
  // qui sont résiliés)". Chargés eagerly avec le reste des onglets pour
  // rester cohérent avec le pattern existant du tiroir.
  const [contratsCompagnie, setContratsCompagnie] = useState<Contrat[]>([]);
  const [chargementContrats, setChargementContrats] = useState(false);
  const [filtreStatutContrats, setFiltreStatutContrats] = useState<"Tous" | "Actif" | "En renouvellement" | "Expiré" | "Résilié">("Tous");

  const [generalForm, setGeneralForm] = useState({
    nom: "", pays: "", code: "", prefixeNumeroPolice: "", codeCourtier: "", compagnieMereId: "", agenceId: "", tauxCommissionMaladie: 0, tauxCommissionAssistance: 0,
    plafondFamilialDefaut: 0, limiteAgeAdulteDefaut: 0, limiteAgeEnfantDefaut: 0,
  });
  const [savingGeneral, setSavingGeneral] = useState(false);
  // Déclinaison d'agence (2026-09) — voir demande utilisateur : un contrat
  // géré par l'agence de POG et placé sur NSIA doit être imputé à "NSIA
  // ASSURANCES POG". Seules les compagnies principales (jamais une autre
  // déclinaison, ni un profil Auto-Gestion) peuvent être mère.
  const [meresPossibles, setMeresPossibles] = useState<Compagnie[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);
  useEffect(() => {
    getCompagnies().then((cs) => setMeresPossibles(cs.filter((c) => c.id !== selected.id && !c.compagnieMereId && !c.clientId))).catch(() => undefined);
    getAgences().then(setAgences).catch(() => undefined);
  }, [selected.id]);

  // Papier en-tête / pied de page légal + RIB (2026-08) — repris sur la
  // Facture Production imprimée sur le papier de la compagnie (voir
  // demande utilisateur).
  const [papierForm, setPapierForm] = useState({
    raisonSociale: "", capitalSocial: "", rccm: "", statistique: "",
    adresseSiege: "", boitePostale: "", ville: "", telephone: "", fax: "", emailContact: "", siteWeb: "",
    banqueNom: "", banqueNumeroCompte: "", notePaiementDefaut: "", piedDePageLegal: "",
  });
  const [savingPapier, setSavingPapier] = useState(false);

  const [garantiesBranche, setGarantiesBranche] = useState<"Maladie" | "Assistance">("Maladie");
  const [garantiesRows, setGarantiesRows] = useState<GarantieRow[]>([]);
  const [savingGaranties, setSavingGaranties] = useState(false);

  const [accessoiresRows, setAccessoiresRows] = useState<AccessoireRow[]>([]);
  const [savingAccessoires, setSavingAccessoires] = useState(false);

  const [surprimesRows, setSurprimesRows] = useState<SurprimeRow[]>([]);
  const [savingSurprimes, setSavingSurprimes] = useState(false);

  const [clausesRows, setClausesRows] = useState<ClauseRow[]>([]);
  const [savingClauses, setSavingClauses] = useState(false);

  const [territorialitesRows, setTerritorialitesRows] = useState<TerritorialiteRow[]>([]);
  const [savingTerritorialites, setSavingTerritorialites] = useState(false);
  const [tauxCouvertureRows, setTauxCouvertureRows] = useState<TauxCouvertureRow[]>([]);
  const [savingTauxCouverture, setSavingTauxCouverture] = useState(false);

  // Recharge les brouillons d'édition à chaque changement de compagnie
  // sélectionnée (pas à chaque `onSaved`) — pour ne jamais mélanger une
  // saisie non enregistrée avec les données d'une autre compagnie.
  useEffect(() => {
    setActiveTab("general");
    setGeneralForm({
      nom: selected.nom, pays: selected.pays, code: selected.code ?? "",
      prefixeNumeroPolice: selected.prefixeNumeroPolice ?? "",
      codeCourtier: selected.codeCourtier ?? "",
      compagnieMereId: selected.compagnieMereId ?? "",
      agenceId: selected.agenceId ?? "",
      tauxCommissionMaladie: selected.tauxCommissionMaladie ?? 0,
      tauxCommissionAssistance: selected.tauxCommissionAssistance ?? 0,
      plafondFamilialDefaut: selected.plafondFamilialDefaut ?? 0,
      limiteAgeAdulteDefaut: selected.limiteAgeAdulteDefaut ?? 0,
      limiteAgeEnfantDefaut: selected.limiteAgeEnfantDefaut ?? 0,
    });
    setPapierForm({
      raisonSociale: selected.raisonSociale ?? "", capitalSocial: selected.capitalSocial ?? "",
      rccm: selected.rccm ?? "", statistique: selected.statistique ?? "",
      adresseSiege: selected.adresseSiege ?? "", boitePostale: selected.boitePostale ?? "", ville: selected.ville ?? "",
      telephone: selected.telephone ?? "", fax: selected.fax ?? "", emailContact: selected.emailContact ?? "", siteWeb: selected.siteWeb ?? "",
      banqueNom: selected.banqueNom ?? "", banqueNumeroCompte: selected.banqueNumeroCompte ?? "",
      notePaiementDefaut: selected.notePaiementDefaut ?? "",
      piedDePageLegal: selected.piedDePageLegal ?? "",
    });
    setAccessoiresRows(selected.accessoires.map((a) => ({ borneMin: a.borneMin, borneMax: a.borneMax, montant: a.montant })));
    setSurprimesRows(selected.surprimesAge.map((s) => ({ ageMin: s.ageMin, ageMax: s.ageMax, tauxPourcent: s.tauxPourcent })));
    setClausesRows(selected.clausesAjustement.map((c) => ({ spMin: c.spMin, spMax: c.spMax, tauxAjustement: c.tauxAjustement, description: c.description ?? "" })));
    setTerritorialitesRows(selected.territorialites.map((t) => ({ libelle: t.libelle })));
    setTauxCouvertureRows(selected.tauxCouverture.map((t) => ({ tauxAmbulatoire: t.tauxAmbulatoire, tauxHospitalisation: t.tauxHospitalisation })));
    setGarantiesBranche("Maladie");
    setFiltreStatutContrats("Tous");
    setChargementContrats(true);
    getContrats(selected.id)
      .then(setContratsCompagnie)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Chargement des contrats impossible."))
      .finally(() => setChargementContrats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  // Recharge la liste des garanties à chaque changement de compagnie OU de
  // branche affichée (une compagnie a deux catalogues distincts).
  useEffect(() => {
    setGarantiesRows(
      selected.garantiesCatalogue
        .filter((g) => g.branche === garantiesBranche)
        .map((g) => ({
          categorie: g.categorie, libelle: g.libelle, plafondDefaut: g.plafondDefaut ?? "",
          tauxStructurePriveeDefaut: g.tauxStructurePriveeDefaut ?? "", tauxStructurePubliqueDefaut: g.tauxStructurePubliqueDefaut ?? "",
        })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id, garantiesBranche]);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await updateCompagnie(selected.id, generalForm);
      toast.success("Compagnie mise à jour.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSavePapier = async () => {
    setSavingPapier(true);
    try {
      await updateCompagnie(selected.id, papierForm);
      toast.success("Papier en-tête et coordonnées bancaires enregistrés.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingPapier(false);
    }
  };

  const handleDeleteCompagnie = async () => {
    if (!window.confirm(`Supprimer ${selected.nom} ?`)) return;
    try {
      await deleteCompagnie(selected.id);
      toast.success("Supprimé.");
      onClose();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleUploadLogo = async (file: File) => {
    try {
      await uploadCompagnieLogo(selected.id, file);
      onSaved();
      toast.success("Logo mis à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi du logo impossible.");
    }
  };

  const handleDeleteLogo = async () => {
    try {
      await deleteCompagnieLogo(selected.id);
      onSaved();
      toast.success("Logo supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleSaveAccessoires = async () => {
    setSavingAccessoires(true);
    try {
      await replaceAccessoires(selected.id, accessoiresRows);
      toast.success("Grille d'accessoires enregistrée.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingAccessoires(false);
    }
  };

  const handleSaveSurprimes = async () => {
    setSavingSurprimes(true);
    try {
      await replaceSurprimesAge(selected.id, surprimesRows);
      toast.success("Table de surprimes d'âge enregistrée.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingSurprimes(false);
    }
  };

  const handleSaveClauses = async () => {
    setSavingClauses(true);
    try {
      await replaceClausesAjustement(selected.id, clausesRows.map((c) => ({ ...c, description: c.description || null })));
      toast.success("Clauses d'ajustement enregistrées.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingClauses(false);
    }
  };

  const handleSaveTerritorialites = async () => {
    setSavingTerritorialites(true);
    try {
      await replaceTerritorialites(selected.id, territorialitesRows);
      toast.success("Territorialités enregistrées.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingTerritorialites(false);
    }
  };

  const handleSaveTauxCouverture = async () => {
    setSavingTauxCouverture(true);
    try {
      await replaceTauxCouverture(selected.id, tauxCouvertureRows);
      toast.success("Taux de couverture enregistrés.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingTauxCouverture(false);
    }
  };

  // Portail vers la fiche contrat (voir CLE_CONTRAT_A_OUVRIR ci-dessus) —
  // ferme le tiroir compagnie et bascule sur l'écran Contrats, qui ouvre
  // directement la fiche visée à son montage.
  const handleOuvrirContrat = (c: Contrat) => {
    sessionStorage.setItem(CLE_CONTRAT_A_OUVRIR, c.id);
    onClose();
    setView("contrats");
  };

  const contratsFiltres = contratsCompagnie.filter((c) => filtreStatutContrats === "Tous" || c.statut === filtreStatutContrats);
  const compteursStatutContrats = contratsCompagnie.reduce<Record<string, number>>((acc, c) => {
    acc[c.statut] = (acc[c.statut] ?? 0) + 1;
    return acc;
  }, {});

  const handleSaveGaranties = async () => {
    setSavingGaranties(true);
    try {
      await replaceGarantiesCatalogue(selected.id, garantiesBranche, garantiesRows.map((g) => ({
        categorie: g.categorie, libelle: g.libelle, plafondDefaut: g.plafondDefaut || null,
        tauxAssureDefaut: null, tauxAyantsDroitDefaut: null,
        tauxStructurePriveeDefaut: g.tauxStructurePriveeDefaut || null, tauxStructurePubliqueDefaut: g.tauxStructurePubliqueDefaut || null,
      })));
      toast.success(`Garanties ${garantiesBranche} enregistrées.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSavingGaranties(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <CompagnieLogo logo={selected.logo} taille={32} />
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">{titrePrefix} — {selected.nom}</h3>
              <p className="text-[11px] text-muted-foreground">{selected.pays}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>

        <div className="px-5 pt-3 border-b border-border flex items-center gap-1 flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 text-[12.5px] font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
              <div>
                <p className={sectionCls}>Identité</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block"><div className={labelCls}>Nom</div><input value={generalForm.nom} onChange={(e) => setGeneralForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Pays</div><input value={generalForm.pays} onChange={(e) => setGeneralForm((v) => ({ ...v, pays: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Code compagnie</div><input value={generalForm.code} onChange={(e) => setGeneralForm((v) => ({ ...v, code: e.target.value }))} className={fieldCls} placeholder="ex: 4595" /></label>
                  <label className="block">
                    <div className={labelCls}>Préfixe des numéros de police</div>
                    <input value={generalForm.prefixeNumeroPolice} onChange={(e) => setGeneralForm((v) => ({ ...v, prefixeNumeroPolice: e.target.value }))} className={fieldCls} placeholder="ex: 1000, R060…" />
                    <p className="text-[11px] text-muted-foreground mt-1">Distinct du code compagnie ci-dessus — sert de point de départ à la génération automatique des numéros de police (ex. "R060" → R0603158, R0603159…).</p>
                  </label>
                  <label className="block">
                    <div className={labelCls}>Code Assuré (courtier)</div>
                    <input value={generalForm.codeCourtier} onChange={(e) => setGeneralForm((v) => ({ ...v, codeCourtier: e.target.value }))} className={fieldCls} placeholder="ex: INSCMP20260000001-QU2M4" />
                    <p className="text-[11px] text-muted-foreground mt-1">Numéro d'immatriculation du courtier auprès de cette compagnie — figure sur le Bordereau de Production.</p>
                  </label>
                </div>

                {!selected.clientId && (
                  <>
                    <p className={`${sectionCls} mt-6`}>Déclinaison d'agence</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className={labelCls}>Compagnie mère</div>
                        <Combobox
                          options={meresPossibles}
                          value={meresPossibles.find((c) => c.id === generalForm.compagnieMereId) ?? null}
                          onChange={(c) => setGeneralForm((v) => ({ ...v, compagnieMereId: c?.id ?? "" }))}
                          getLabel={(c) => c.nom} getId={(c) => c.id}
                          allowClear clearLabel="Aucune (compagnie principale)"
                          placeholder="Rechercher…"
                        />
                      </div>
                      <div>
                        <div className={labelCls}>Agence</div>
                        <Combobox
                          options={agences.filter((a) => a.statut === "Actif" || a.id === generalForm.agenceId)}
                          value={agences.find((a) => a.id === generalForm.agenceId) ?? null}
                          onChange={(a) => setGeneralForm((v) => ({ ...v, agenceId: a?.id ?? "" }))}
                          getLabel={(a) => (a.code ? `${a.nom} (${a.code})` : a.nom)} getId={(a) => a.id}
                          allowClear clearLabel="Aucune"
                          placeholder="Rechercher…"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Ex. « NSIA ASSURANCES POG » : mère NSIA ASSURANCES, agence Port-Gentil. Tout contrat de cette agence placé sur la compagnie mère lui est alors imputé automatiquement. Laissez vide pour une compagnie principale.
                    </p>
                  </>
                )}

                <div className="flex items-center gap-2 mt-6">
                  <button type="button" disabled={savingGeneral} onClick={handleSaveGeneral} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
                  <button type="button" onClick={handleDeleteCompagnie} className="h-9 px-4 rounded-lg border border-destructive/40 text-destructive text-[13px] hover:bg-destructive/10 inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Supprimer</button>
                </div>
              </div>

              <div>
                <p className={sectionCls}>Logo</p>
                <div className="border border-border rounded-lg p-3 space-y-2.5">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-secondary/40 flex items-center justify-center">
                    {compagnieLogoUrl(selected.logo)
                      ? <img src={compagnieLogoUrl(selected.logo)} alt="" className="w-full h-full object-contain bg-white" />
                      : <Building2 className="w-12 h-12 text-muted-foreground" />}
                  </div>
                  <label className="block">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) handleUploadLogo(file);
                    }} />
                    <span className="block text-center h-9 leading-9 rounded-lg bg-emerald-600 text-white text-[13px] font-medium cursor-pointer hover:opacity-90">+ Télécharger</span>
                  </label>
                  {selected.logo && (
                    <button type="button" onClick={handleDeleteLogo} className="w-full h-9 rounded-lg bg-destructive text-destructive-foreground text-[13px] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" />Supprimer le logo
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "commission" && (
            <div>
              <p className={sectionCls}>Taux de commission par branche</p>
              <p className="text-[12px] text-muted-foreground mb-4">Repris automatiquement dans le calcul de prime d'un Contrat/Avenant, selon la branche sélectionnée — modifiable ensuite au cas par cas.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                <label className="block"><div className={labelCls}>Commission Maladie (%)</div><input type="number" step="0.1" value={generalForm.tauxCommissionMaladie} onChange={(e) => setGeneralForm((v) => ({ ...v, tauxCommissionMaladie: Number(e.target.value) }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Commission Assistance (%)</div><input type="number" step="0.1" value={generalForm.tauxCommissionAssistance} onChange={(e) => setGeneralForm((v) => ({ ...v, tauxCommissionAssistance: Number(e.target.value) }))} className={fieldCls} /></label>
              </div>

              <p className={sectionCls}>Valeurs par défaut pour une nouvelle cotation</p>
              <p className="text-[12px] text-muted-foreground mb-4">Reprises pour pré-remplir une nouvelle cotation pour cette compagnie (écran Cotation) — librement ajustables ensuite au cas par cas.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                <label className="block"><div className={labelCls}>Plafond familial par défaut (FCFA)</div><input type="number" value={generalForm.plafondFamilialDefaut} onChange={(e) => setGeneralForm((v) => ({ ...v, plafondFamilialDefaut: Number(e.target.value) }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Limite d'âge adulte (ans)</div><input type="number" value={generalForm.limiteAgeAdulteDefaut} onChange={(e) => setGeneralForm((v) => ({ ...v, limiteAgeAdulteDefaut: Number(e.target.value) }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Limite d'âge enfant (ans)</div><input type="number" value={generalForm.limiteAgeEnfantDefaut} onChange={(e) => setGeneralForm((v) => ({ ...v, limiteAgeEnfantDefaut: Number(e.target.value) }))} className={fieldCls} /></label>
              </div>

              <button type="button" disabled={savingGeneral} onClick={handleSaveGeneral} className="h-9 px-4 mt-5 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          )}

          {activeTab === "papier" && (
            <div>
              <p className={sectionCls}>Pied de page légal — texte exact imprimé</p>
              <p className="text-[12px] text-muted-foreground mb-4">Texte VERBATIM tel qu'il apparaît sur le vrai papier en-tête de la compagnie — c'est ce texte, tel quel, qui est imprimé en pied de page de la Facture Production (jamais reconstruit à partir des champs structurés ci-dessous).</p>
              <label className="block max-w-3xl mb-6"><textarea value={papierForm.piedDePageLegal} onChange={(e) => setPapierForm((v) => ({ ...v, piedDePageLegal: e.target.value }))} rows={5} className={fieldCls} placeholder="ex. NSIA Assurances (Gabon), Société Anonyme avec Conseil d'Administration, entreprise régie par le code des assurances, au capital de 10 584 750 000 F CFA, dont le siège social est situé à Libreville..." /></label>

              <p className={sectionCls}>Champs structurés (référence — non imprimés directement)</p>
              <p className="text-[12px] text-muted-foreground mb-4">Utiles comme aide-mémoire administratif ; le pied de page imprimé utilise le texte exact ci-dessus.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2"><div className={labelCls}>Raison sociale affichée</div><input value={papierForm.raisonSociale} onChange={(e) => setPapierForm((v) => ({ ...v, raisonSociale: e.target.value }))} className={fieldCls} placeholder="ex. BGFI ASSURANCES" /></label>
                <label className="block"><div className={labelCls}>Capital social</div><input value={papierForm.capitalSocial} onChange={(e) => setPapierForm((v) => ({ ...v, capitalSocial: e.target.value }))} className={fieldCls} placeholder="ex. 6 000 000 000 F CFA entièrement libéré" /></label>
                <label className="block"><div className={labelCls}>RCCM</div><input value={papierForm.rccm} onChange={(e) => setPapierForm((v) => ({ ...v, rccm: e.target.value }))} className={fieldCls} placeholder="ex. 2007B05810" /></label>
                <label className="block"><div className={labelCls}>N° Statistique</div><input value={papierForm.statistique} onChange={(e) => setPapierForm((v) => ({ ...v, statistique: e.target.value }))} className={fieldCls} placeholder="ex. 798020 C" /></label>
                <label className="block"><div className={labelCls}>Boîte postale</div><input value={papierForm.boitePostale} onChange={(e) => setPapierForm((v) => ({ ...v, boitePostale: e.target.value }))} className={fieldCls} placeholder="ex. BP 7812" /></label>
                <label className="block md:col-span-2"><div className={labelCls}>Adresse du siège</div><input value={papierForm.adresseSiege} onChange={(e) => setPapierForm((v) => ({ ...v, adresseSiege: e.target.value }))} className={fieldCls} placeholder="ex. Boulevard de l'Indépendance, Immeuble Odyssée" /></label>
                <label className="block"><div className={labelCls}>Ville</div><input value={papierForm.ville} onChange={(e) => setPapierForm((v) => ({ ...v, ville: e.target.value }))} className={fieldCls} placeholder="ex. Libreville" /></label>
                <label className="block"><div className={labelCls}>Téléphone</div><input value={papierForm.telephone} onChange={(e) => setPapierForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Fax</div><input value={papierForm.fax} onChange={(e) => setPapierForm((v) => ({ ...v, fax: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Email</div><input value={papierForm.emailContact} onChange={(e) => setPapierForm((v) => ({ ...v, emailContact: e.target.value }))} className={fieldCls} /></label>
                <label className="block md:col-span-2"><div className={labelCls}>Site web</div><input value={papierForm.siteWeb} onChange={(e) => setPapierForm((v) => ({ ...v, siteWeb: e.target.value }))} className={fieldCls} /></label>
              </div>

              <p className={sectionCls}>Coordonnées bancaires</p>
              <p className="text-[12px] text-muted-foreground mb-4">Reprises sur la Facture Production ("N° Compte...").</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <label className="block"><div className={labelCls}>Banque</div><input value={papierForm.banqueNom} onChange={(e) => setPapierForm((v) => ({ ...v, banqueNom: e.target.value }))} className={fieldCls} placeholder="ex. BICIG" /></label>
                <label className="block"><div className={labelCls}>N° de compte</div><input value={papierForm.banqueNumeroCompte} onChange={(e) => setPapierForm((v) => ({ ...v, banqueNumeroCompte: e.target.value }))} className={fieldCls} placeholder="ex. 40001 09070 07000032701 72" /></label>
              </div>

              <p className={sectionCls}>Note de paiement par défaut</p>
              <p className="text-[12px] text-muted-foreground mb-4">Pré-remplit la Facture Production pour cette compagnie — reste modifiable au cas par cas.</p>
              <label className="block max-w-2xl"><textarea value={papierForm.notePaiementDefaut} onChange={(e) => setPapierForm((v) => ({ ...v, notePaiementDefaut: e.target.value }))} rows={3} className={fieldCls} placeholder={"ex. NB : Le Règlement doit se faire par tout mode de paiement au plus tard le [date d'échéance].\nEn cas de règlement par chèque, prière de l'établir à l'ordre de la compagnie…"} /></label>

              <button type="button" disabled={savingPapier} onClick={handleSavePapier} className="h-9 px-4 mt-5 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          )}

          {activeTab === "garanties" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={sectionCls}>Tableau de garanties et plafonds</p>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                  {(["Maladie", "Assistance"] as const).map((b) => (
                    <button key={b} type="button" onClick={() => setGarantiesBranche(b)}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${garantiesBranche === b ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground mb-4">Propre à cette compagnie — tel que transmis dans ses offres. Pré-remplit automatiquement une nouvelle cotation pour la branche {garantiesBranche.toLowerCase()}, reste éditable ensuite au cas par cas.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                      <th className="text-left px-4 py-2">Catégorie</th>
                      <th className="text-left px-3 py-2">Libellé</th>
                      <th className="text-left px-3 py-2">Structure privée</th>
                      <th className="text-left px-3 py-2">Structure publique</th>
                      <th className="text-left px-3 py-2">Plafond (si pas de distinction)</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {garantiesRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><input value={row.categorie} onChange={(e) => setGarantiesRows((r) => r.map((x, idx) => idx === i ? { ...x, categorie: e.target.value } : x))} className={fieldCls} placeholder="ex. Médecine" /></td>
                        <td className="px-3 py-2"><input value={row.libelle} onChange={(e) => setGarantiesRows((r) => r.map((x, idx) => idx === i ? { ...x, libelle: e.target.value } : x))} className={fieldCls} placeholder="ex. Consultations, visites, analyses médicales" /></td>
                        <td className="px-3 py-2"><input value={row.tauxStructurePriveeDefaut} onChange={(e) => setGarantiesRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxStructurePriveeDefaut: e.target.value } : x))} className={fieldCls} placeholder="ex. 100% du barème" /></td>
                        <td className="px-3 py-2"><input value={row.tauxStructurePubliqueDefaut} onChange={(e) => setGarantiesRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxStructurePubliqueDefaut: e.target.value } : x))} className={fieldCls} placeholder="ex. 100% des frais réels" /></td>
                        <td className="px-3 py-2"><input value={row.plafondDefaut} onChange={(e) => setGarantiesRows((r) => r.map((x, idx) => idx === i ? { ...x, plafondDefaut: e.target.value } : x))} className={fieldCls} placeholder="ex. 400 000 FCFA" /></td>
                        <td className="px-3 py-2 text-center"><button type="button" onClick={() => setGarantiesRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {garantiesRows.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucune garantie paramétrée pour la branche {garantiesBranche}.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Structure privée/publique : à remplir seulement quand le taux diffère selon le type d'établissement (ex. hôpital public vs clinique privée) ; sinon, utiliser uniquement Plafond.</p>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => setGarantiesRows((r) => [...r, { categorie: "", libelle: "", plafondDefaut: "", tauxStructurePriveeDefaut: "", tauxStructurePubliqueDefaut: "" }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter une garantie</button>
                <button type="button" disabled={savingGaranties} onClick={handleSaveGaranties} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          )}

          {activeTab === "accessoires" && (
            <div>
              <p className={sectionCls}>Grille d'accessoires (par tranche de prime nette)</p>
              <p className="text-[12px] text-muted-foreground mb-4">Montant forfaitaire suggéré dans le calcul de prime selon la prime nette calculée — le gestionnaire garde la main pour ajuster.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                      <th className="text-left px-4 py-2">Borne min</th>
                      <th className="text-left px-3 py-2">Borne max</th>
                      <th className="text-left px-3 py-2">Montant</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {accessoiresRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><input type="number" value={row.borneMin} onChange={(e) => setAccessoiresRows((r) => r.map((x, idx) => idx === i ? { ...x, borneMin: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" value={row.borneMax ?? ""} placeholder="illimité" onChange={(e) => setAccessoiresRows((r) => r.map((x, idx) => idx === i ? { ...x, borneMax: e.target.value === "" ? null : Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" value={row.montant} onChange={(e) => setAccessoiresRows((r) => r.map((x, idx) => idx === i ? { ...x, montant: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2 text-center"><button type="button" onClick={() => setAccessoiresRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {accessoiresRows.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucune tranche paramétrée.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => setAccessoiresRows((r) => [...r, { borneMin: 0, borneMax: null, montant: 0 }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter une tranche</button>
                <button type="button" disabled={savingAccessoires} onClick={handleSaveAccessoires} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          )}

          {activeTab === "surprimes" && (
            <div>
              <p className={sectionCls}>Surprimes d'âge</p>
              <p className="text-[12px] text-muted-foreground mb-4">Majoration par tranche d'âge, appliquée optionnellement (case à cocher) dans le calcul de prime d'un Contrat/Avenant.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                      <th className="text-left px-4 py-2">Âge min</th>
                      <th className="text-left px-3 py-2">Âge max</th>
                      <th className="text-left px-3 py-2">Taux (%)</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {surprimesRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><input type="number" value={row.ageMin} onChange={(e) => setSurprimesRows((r) => r.map((x, idx) => idx === i ? { ...x, ageMin: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" value={row.ageMax ?? ""} placeholder="et plus" onChange={(e) => setSurprimesRows((r) => r.map((x, idx) => idx === i ? { ...x, ageMax: e.target.value === "" ? null : Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" step="0.1" value={row.tauxPourcent} onChange={(e) => setSurprimesRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxPourcent: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2 text-center"><button type="button" onClick={() => setSurprimesRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {surprimesRows.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucune tranche paramétrée.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => setSurprimesRows((r) => [...r, { ageMin: 0, ageMax: null, tauxPourcent: 0 }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter une tranche</button>
                <button type="button" disabled={savingSurprimes} onClick={handleSaveSurprimes} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          )}

          {activeTab === "clauses" && (
            <div>
              <p className={sectionCls}>Clauses d'ajustement (ratio Sinistres/Prime)</p>
              <p className="text-[12px] text-muted-foreground mb-4">Règles d'ajustement de prime négociées au renouvellement selon le S/P constaté — donnée de référence, consultée par le gestionnaire.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                      <th className="text-left px-4 py-2">S/P min (%)</th>
                      <th className="text-left px-3 py-2">S/P max (%)</th>
                      <th className="text-left px-3 py-2">Ajustement (%)</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {clausesRows.map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><input type="number" step="0.1" value={row.spMin} onChange={(e) => setClausesRows((r) => r.map((x, idx) => idx === i ? { ...x, spMin: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" step="0.1" value={row.spMax ?? ""} placeholder="et plus" onChange={(e) => setClausesRows((r) => r.map((x, idx) => idx === i ? { ...x, spMax: e.target.value === "" ? null : Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input type="number" step="0.1" value={row.tauxAjustement} onChange={(e) => setClausesRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxAjustement: Number(e.target.value) } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2"><input value={row.description} onChange={(e) => setClausesRows((r) => r.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} className={fieldCls} /></td>
                        <td className="px-3 py-2 text-center"><button type="button" onClick={() => setClausesRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                    {clausesRows.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucune clause paramétrée.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={() => setClausesRows((r) => [...r, { spMin: 0, spMax: null, tauxAjustement: 0, description: "" }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter une clause</button>
                <button type="button" disabled={savingClauses} onClick={handleSaveClauses} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          )}

          {activeTab === "baremes" && (
            <div className="space-y-8">
              <div>
                <p className={sectionCls}>Territorialités proposées</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-border/50">
                      {territorialitesRows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2"><input value={row.libelle} onChange={(e) => setTerritorialitesRows((r) => r.map((x, idx) => idx === i ? { libelle: e.target.value } : x))} className={fieldCls} placeholder="ex. GABON -PAYS CIMA- AFRIQUE DU SUD-UNION EUROPEENNE" /></td>
                          <td className="px-3 py-2 text-center w-10"><button type="button" onClick={() => setTerritorialitesRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                      {territorialitesRows.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucune territorialité paramétrée.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => setTerritorialitesRows((r) => [...r, { libelle: "" }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter une territorialité</button>
                  <button type="button" disabled={savingTerritorialites} onClick={handleSaveTerritorialites} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
                </div>
              </div>

              <div>
                <p className={sectionCls}>Taux de couverture proposés</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                        <th className="text-left px-4 py-2">Ambulatoire</th>
                        <th className="text-left px-3 py-2">Hospitalisation</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {tauxCouvertureRows.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2"><input value={row.tauxAmbulatoire} onChange={(e) => setTauxCouvertureRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxAmbulatoire: e.target.value } : x))} className={fieldCls} placeholder="ex. 80%" /></td>
                          <td className="px-3 py-2"><input value={row.tauxHospitalisation} onChange={(e) => setTauxCouvertureRows((r) => r.map((x, idx) => idx === i ? { ...x, tauxHospitalisation: e.target.value } : x))} className={fieldCls} placeholder="ex. 100%" /></td>
                          <td className="px-3 py-2 text-center"><button type="button" onClick={() => setTauxCouvertureRows((r) => r.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                      {tauxCouvertureRows.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground text-[12px]">Aucun taux de couverture paramétré.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => setTauxCouvertureRows((r) => [...r, { tauxAmbulatoire: "", tauxHospitalisation: "" }])} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter un taux de couverture</button>
                  <button type="button" disabled={savingTauxCouverture} onClick={handleSaveTauxCouverture} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "contrats" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={sectionCls}>Contrats liés à cette compagnie</p>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 flex-wrap">
                  {(["Tous", "Actif", "En renouvellement", "Expiré", "Résilié"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setFiltreStatutContrats(s)}
                      className={`px-2.5 py-1.5 text-[11.5px] rounded-md transition-colors whitespace-nowrap ${filtreStatutContrats === s ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s}{s !== "Tous" && compteursStatutContrats[s] ? ` (${compteursStatutContrats[s]})` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground mb-4">Tous exercices confondus — cliquez sur un contrat pour l'ouvrir directement dans l'écran Contrats.</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground uppercase bg-secondary/30">
                      <th className="text-left px-4 py-2">N° Police</th>
                      <th className="text-left px-3 py-2">Souscripteur</th>
                      <th className="text-left px-3 py-2">Branche</th>
                      <th className="text-left px-3 py-2">Période</th>
                      <th className="text-left px-3 py-2">Exercice</th>
                      <th className="text-right px-3 py-2">Prime</th>
                      <th className="text-left px-3 py-2">Statut</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {chargementContrats && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground text-[12px]">Chargement…</td></tr>}
                    {!chargementContrats && contratsFiltres.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground text-[12px]">Aucun contrat {filtreStatutContrats !== "Tous" ? `au statut "${filtreStatutContrats}" ` : ""}pour cette compagnie.</td></tr>
                    )}
                    {contratsFiltres.map((c) => (
                      <tr key={c.id} className="hover:bg-secondary/20 cursor-pointer" onClick={() => handleOuvrirContrat(c)}>
                        <td className="px-4 py-2 font-semibold text-foreground med-num">{numeroPolice(c)}</td>
                        <td className="px-3 py-2 text-foreground">{c.client}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.branche}</td>
                        <td className="px-3 py-2 text-muted-foreground med-num">{c.dateDebut} → {c.dateFin}</td>
                        <td className="px-3 py-2 text-muted-foreground med-num">{c.exerciceNumero ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-foreground med-num">{fmtM(c.prime)} FCFA</td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            c.statut === "Actif" ? "bg-emerald-500/15 text-emerald-700"
                            : c.statut === "Résilié" ? "bg-destructive/15 text-destructive"
                            : c.statut === "Expiré" ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/15 text-amber-700"
                          }`}>{c.statut}</span>
                        </td>
                        <td className="px-3 py-2 text-center"><ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

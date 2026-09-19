import { useEffect, useState } from "react";
import { Calculator, Save, Plus, Trash2, FileDown, PackagePlus, Pencil, X, Image as ImageIcon, Building2, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import {
  getCotations, createCotation, updateCotation,
  uploadCotationLogo, deleteCotationLogo, cotationLogoUrl,
} from "@/services/cotation.service";
import { getCompagnies } from "@/services/compagnies.service";
import { getAppelsOffres } from "@/services/appelOffres.service";
import { uploadProspectLogo, deleteProspectLogo, prospectLogoUrl } from "@/services/crm.service";
import { openCotationOffre, openReseauSoins } from "@/services/documents.service";
import type { Cotation, CotationInput } from "@/types/cotation";
import type { Compagnie } from "@/types/compagnies";
import type { AppelOffres } from "@/types/appelOffres";

const inputClass = "w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors";
const labelClass = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

// Clé sessionStorage utilisée par l'écran Appels d'Offres ("Lancer une
// cotation pour cet AO") — même mécanisme de handoff déjà utilisé ailleurs
// cette session (ex. Renouvellements → Avenants).
const CLE_AO_HANDOFF = "medassur:cotation-appel-offres";

// Même taux que backend/src/cotation/cotation.service.ts (TAUX_TAXE_GABON)
// — miroir client pour l'aperçu avant enregistrement, le serveur reste
// l'autorité finale sur le calcul stocké.
const TAUX_TAXE_GABON = 0.08;

// Plage standard des taux de couverture pratiqués (voir seed.ts
// tauxCouvertureStandard) — de 60% à 100%, indépendamment de la compagnie ;
// la liste "combinaisons suggérées" ci-dessous reste la source privilégiée
// quand la compagnie en a paramétré, ces deux menus couvrent le cas général.
const TAUX_COUVERTURE_OPTIONS = ["100%", "90%", "80%", "70%", "60%"];

function defaultLigne(): CotationInput {
  return {
    branche: "Maladie", clientNom: "", population: 0, territorialite: "",
    primeNette: 0, montantCartes: 0, montantAccessoires: 0, garanties: [],
  };
}

// Une cotation, au sens métier, peut regrouper les offres de plusieurs
// compagnies (et de leurs deux branches Maladie/Assistance) pour un même
// client/AO — on les construit une par une dans ce formulaire (`ligne`),
// on les met de côté (`lignesEnAttente`), puis on les enregistre et on
// génère le document combiné en une seule fois.
export default function CotationView() {
  const [ligne, setLigne] = useState<CotationInput>(defaultLigne());
  const [primeNetteParPersonne, setPrimeNetteParPersonne] = useState(0);
  const [carteParPersonne, setCarteParPersonne] = useState(0);
  const [lignesEnAttente, setLignesEnAttente] = useState<CotationInput[]>([]);
  const [aoHandoffNom, setAoHandoffNom] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cotations, setCotations] = useState<Cotation[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [appelsOffres, setAppelsOffres] = useState<AppelOffres[]>([]);
  const [selectionHistorique, setSelectionHistorique] = useState<string[]>([]);
  // Cotation déjà enregistrée en cours de modification (bouton "Modifier"
  // du tableau historique) — distinct du flux normal de mise en attente,
  // s'applique directement à un enregistrement existant via PATCH.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingProspectLogo, setUploadingProspectLogo] = useState(false);
  // Logo côté cotation (client sans appel d'offres, donc sans Prospect à
  // rattacher) — deux cas : `editingLogo` reflète le logo déjà enregistré
  // d'une cotation en cours de modification (upload immédiat possible,
  // l'id existe déjà) ; `pendingLogoFile` met en attente un fichier choisi
  // pendant la construction d'une cotation pas encore enregistrée (upload
  // différé à la première cotation créée, voir handleEnregistrer).
  const [editingLogo, setEditingLogo] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [uploadingCotationLogo, setUploadingCotationLogo] = useState(false);

  const refreshAppelsOffres = () => getAppelsOffres().then(setAppelsOffres);

  useEffect(() => {
    getCotations().then(setCotations);
    getCompagnies().then(setCompagnies);
    refreshAppelsOffres();
  }, []);

  useEffect(() => {
    const brut = sessionStorage.getItem(CLE_AO_HANDOFF);
    if (!brut) return;
    sessionStorage.removeItem(CLE_AO_HANDOFF);
    try {
      const { id, clientNom } = JSON.parse(brut) as { id: string; clientNom: string };
      setLigne((v) => ({ ...v, appelOffresId: id, clientNom }));
      setAoHandoffNom(clientNom);
    } catch {
      // handoff malformé, ignoré
    }
  }, []);

  // Révoque l'URL locale de prévisualisation dès qu'elle change ou que le
  // composant se démonte, pour ne pas fuiter de mémoire.
  useEffect(() => () => { if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview); }, [pendingLogoPreview]);

  const set = <K extends keyof CotationInput>(key: K, value: CotationInput[K]) => setLigne((v) => ({ ...v, [key]: value }));

  // Pré-remplissage automatique depuis les règles paramétrées de la
  // compagnie (voir CompagnieParamsDrawer, onglets Clauses d'ajustement /
  // Barèmes / Garanties) — tout reste éditable ensuite au cas par cas.
  const appliquerPrefill = (compagnie: Compagnie, branche: string) => {
    const garanties = compagnie.garantiesCatalogue
      .filter((g) => g.branche === branche)
      .map((g) => ({
        categorie: g.categorie, libelle: g.libelle, plafond: g.plafondDefaut ?? "",
        tauxStructurePrivee: g.tauxStructurePriveeDefaut ?? undefined, tauxStructurePublique: g.tauxStructurePubliqueDefaut ?? undefined,
      }));
    const clauseTexte = compagnie.clausesAjustement.length > 0
      ? compagnie.clausesAjustement
        .map((c) => `S/P ${c.spMin}%${c.spMax ? `-${c.spMax}%` : " et plus"} : ${c.tauxAjustement >= 0 ? "majoration" : "minoration"} de ${Math.abs(c.tauxAjustement)}%${c.description ? ` (${c.description})` : ""}`)
        .join(" ; ")
      : undefined;
    setLigne((v) => ({
      ...v,
      territorialite: compagnie.territorialites[0]?.libelle ?? v.territorialite,
      clauseAjustement: clauseTexte ?? v.clauseAjustement,
      limiteAgeAdulte: compagnie.limiteAgeAdulteDefaut ?? v.limiteAgeAdulte,
      limiteAgeEnfant: compagnie.limiteAgeEnfantDefaut ?? v.limiteAgeEnfant,
      plafondFamilial: compagnie.plafondFamilialDefaut ?? v.plafondFamilial,
      garanties: garanties.length > 0 ? garanties : v.garanties,
    }));
  };

  const handleCompagnieChange = (compagnieId: string) => {
    set("compagnieId", compagnieId || undefined);
    const compagnie = compagnies.find((c) => c.id === compagnieId);
    if (compagnie) appliquerPrefill(compagnie, ligne.branche);
  };

  const handleBrancheChange = (branche: string) => {
    set("branche", branche);
    const compagnie = compagnies.find((c) => c.id === ligne.compagnieId);
    if (compagnie) appliquerPrefill(compagnie, branche);
  };

  const appelOffresSelectionne = appelsOffres.find((a) => a.id === ligne.appelOffresId) ?? null;
  const compagnieSelectionnee = compagnies.find((c) => c.id === ligne.compagnieId) ?? null;

  // Quand un AO est choisi, le nom du client est systématiquement reporté
  // depuis le prospect lié et figé (non éditable) — un AO a toujours un
  // client déterminé, pas de raison de le retaper ou de le désynchroniser.
  const handleAoChange = (appelOffresId: string) => {
    const ao = appelsOffres.find((a) => a.id === appelOffresId);
    setLigne((v) => ({ ...v, appelOffresId: appelOffresId || undefined, clientNom: ao ? ao.prospect.nom : v.clientNom }));
  };

  // Le modèle transmis affiche "Prime par personne" comme donnée saisie
  // (pas dérivée) : Prime NETTE totale = prime nette/personne × population
  // (idem Cartes) — Accessoires reste un montant forfaitaire par police.
  const primeNetteTotale = Math.round(primeNetteParPersonne * ligne.population);
  const montantCartesTotal = Math.round(carteParPersonne * ligne.population);
  const montantTaxe = Math.round((primeNetteTotale + montantCartesTotal + ligne.montantAccessoires) * TAUX_TAXE_GABON);
  const primeTTC = primeNetteTotale + montantCartesTotal + ligne.montantAccessoires + montantTaxe;

  const compagnieNomLigne = (l: CotationInput) => compagnies.find((c) => c.id === l.compagnieId)?.nom ?? "—";

  // Un même prospect/client ne doit jamais voir ses offres réparties dans
  // plusieurs documents, même ajoutées lors de sessions différentes — le
  // "dossier" est l'AO si renseigné, sinon le nom du client.
  const dossierKey = (c: Pick<Cotation, "appelOffresId" | "clientNom">) => c.appelOffresId ? `ao:${c.appelOffresId}` : `client:${c.clientNom}`;
  const cotationIdsDuDossier = (cle: string, toutes: Cotation[]) => toutes.filter((c) => dossierKey(c) === cle).map((c) => c.id);

  const handleAjouterOffre = () => {
    if (!ligne.compagnieId) { toast.error("Sélectionnez une compagnie."); return; }
    if (!ligne.clientNom || !ligne.territorialite || ligne.population <= 0) {
      toast.error("Client, territorialité et population sont obligatoires.");
      return;
    }
    setLignesEnAttente((v) => [...v, { ...ligne, primeNette: primeNetteTotale, montantCartes: montantCartesTotal }]);
    // Le client/AO/compagnie restent pour enchaîner facilement une autre
    // branche ou une autre compagnie pour la même cotation. Population et
    // limites d'âge sont des caractéristiques du client/de la population
    // assurée (les mêmes personnes, quelle que soit la compagnie consultée)
    // et persistent donc — seul le plafond familial est une règle propre à
    // CHAQUE compagnie (Compagnie.plafondFamilialDefaut) : il repart de
    // zéro et est re-rempli par appliquerPrefill au choix de la compagnie
    // suivante, jamais hérité de l'offre précédente.
    setLigne((v) => ({
      ...defaultLigne(),
      appelOffresId: v.appelOffresId, clientNom: v.clientNom, compagnieId: v.compagnieId,
      branche: v.branche === "Maladie" ? "Assistance" : "Maladie",
      population: v.population, limiteAgeAdulte: v.limiteAgeAdulte, limiteAgeEnfant: v.limiteAgeEnfant,
    }));
    setPrimeNetteParPersonne(0);
    setCarteParPersonne(0);
    toast.success("Offre ajoutée à la cotation en cours.");
  };

  const handleRetirerLigne = (index: number) => setLignesEnAttente((v) => v.filter((_, i) => i !== index));

  const handleEnregistrer = async () => {
    if (lignesEnAttente.length === 0) { toast.error("Ajoutez au moins une offre à la cotation."); return; }
    setSubmitting(true);
    try {
      const crees = await Promise.all(lignesEnAttente.map((l) => createCotation(l)));
      // Logo mis en attente pendant la construction (client sans appel
      // d'offres, donc sans Prospect à rattacher) — importé sur la première
      // cotation créée ; la résolution du logo sur le document scanne
      // toutes les cotations du dossier, une seule suffit.
      if (pendingLogoFile && crees[0]) {
        await uploadCotationLogo(crees[0].id, pendingLogoFile).catch(() => toast.error("La cotation est enregistrée, mais le logo n'a pas pu être importé."));
        if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
        setPendingLogoFile(null);
        setPendingLogoPreview(null);
      }
      const fraiches = await getCotations();
      setCotations(fraiches);
      setLignesEnAttente([]);
      toast.success(`${crees.length} offre(s) enregistrée(s) — ouverture du document combiné.`);
      // Regroupe par dossier (AO ou client) et ouvre TOUTES les cotations de
      // ce dossier, pas seulement celles créées à l'instant — une offre
      // ajoutée dans une session antérieure pour le même client doit
      // apparaître dans le même document.
      const cles = Array.from(new Set(crees.map((c) => dossierKey(c))));
      cles.forEach((cle) => {
        openCotationOffre(cotationIdsDuDossier(cle, fraiches)).catch(() => toast.error("Ouverture du document impossible."));
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  // Modification d'une cotation déjà enregistrée — flux séparé de la mise
  // en attente : s'applique directement à l'enregistrement existant via
  // PATCH, pas de passage par lignesEnAttente.
  const handleModifierCotation = (c: Cotation) => {
    setLigne({
      appelOffresId: c.appelOffresId ?? undefined,
      compagnieId: c.compagnieId ?? undefined,
      branche: c.branche,
      clientNom: c.clientNom,
      population: c.population,
      territorialite: c.territorialite,
      tauxCouvertureAmbulatoire: c.tauxCouvertureAmbulatoire ?? undefined,
      tauxCouvertureHospitalisation: c.tauxCouvertureHospitalisation ?? undefined,
      exclusions: c.exclusions ?? undefined,
      clauseAjustement: c.clauseAjustement ?? undefined,
      limiteAgeAdulte: c.limiteAgeAdulte ?? undefined,
      limiteAgeEnfant: c.limiteAgeEnfant ?? undefined,
      plafondFamilial: c.plafondFamilial ?? undefined,
      conditionsFermete: c.conditionsFermete ?? undefined,
      primeNette: c.primeNette,
      montantCartes: c.montantCartes,
      montantAccessoires: c.montantAccessoires,
      garanties: c.garanties.map((g) => ({ ...g })),
    });
    setPrimeNetteParPersonne(c.population > 0 ? c.primeNette / c.population : 0);
    setCarteParPersonne(c.population > 0 ? c.montantCartes / c.population : 0);
    setEditingId(c.id);
    setEditingLogo(c.logo ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAnnulerModification = () => {
    setEditingId(null);
    setEditingLogo(null);
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setLigne(defaultLigne());
    setPrimeNetteParPersonne(0);
    setCarteParPersonne(0);
  };

  const handleEnregistrerModification = async () => {
    if (!editingId) return;
    if (!ligne.clientNom || !ligne.territorialite || ligne.population <= 0) {
      toast.error("Client, territorialité et population sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      await updateCotation(editingId, { ...ligne, primeNette: primeNetteTotale, montantCartes: montantCartesTotal });
      toast.success("Cotation mise à jour.");
      setCotations(await getCotations());
      handleAnnulerModification();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProspectLogo = async (file: File) => {
    if (!appelOffresSelectionne) return;
    setUploadingProspectLogo(true);
    try {
      await uploadProspectLogo(appelOffresSelectionne.prospect.id, file);
      await refreshAppelsOffres();
      toast.success("Logo du prospect importé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import du logo impossible.");
    } finally {
      setUploadingProspectLogo(false);
    }
  };

  const handleDeleteProspectLogo = async () => {
    if (!appelOffresSelectionne) return;
    try {
      await deleteProspectLogo(appelOffresSelectionne.prospect.id);
      await refreshAppelsOffres();
      toast.success("Logo retiré.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression du logo impossible.");
    }
  };

  // Client SANS appel d'offres (donc sans Prospect à rattacher) : le logo
  // vit directement sur la cotation (voir Cotation.logo). En modification,
  // la cotation existe déjà — upload immédiat. En création, elle n'existe
  // pas encore — le fichier est simplement mis en attente et importé sur la
  // première cotation créée (voir handleEnregistrer).
  const handleUploadCotationLogoImmediat = async (file: File) => {
    if (!editingId) return;
    setUploadingCotationLogo(true);
    try {
      const c = await uploadCotationLogo(editingId, file);
      setEditingLogo(c.logo ?? null);
      setCotations(await getCotations());
      toast.success("Logo importé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import du logo impossible.");
    } finally {
      setUploadingCotationLogo(false);
    }
  };

  const handleDeleteCotationLogoImmediat = async () => {
    if (!editingId) return;
    try {
      await deleteCotationLogo(editingId);
      setEditingLogo(null);
      setCotations(await getCotations());
      toast.success("Logo retiré.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression du logo impossible.");
    }
  };

  const handleSelectPendingLogo = (file: File) => {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoFile(file);
    setPendingLogoPreview(URL.createObjectURL(file));
  };

  const handleRemovePendingLogo = () => {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
  };

  const toggleSelectionHistorique = (id: string) => setSelectionHistorique((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const voirDocument = (ids: string[]) => {
    if (ids.length === 0) return;
    openCotationOffre(ids).catch(() => toast.error("Ouverture du document impossible."));
  };

  const voirDocumentDuDossier = (c: Cotation) => voirDocument(cotationIdsDuDossier(dossierKey(c), cotations));

  // Réseau de soins (2026-08) — voir demande utilisateur : "le réseau qui
  // doit s'ajouter à chaque cotation" ; déjà joint en annexe de chaque offre
  // (voir DocumentsService.dessinerAnnexePrestataires), et accessible ici en
  // téléchargement/impression autonome.
  const voirReseauSoins = () => openReseauSoins().catch(() => toast.error("Ouverture du document impossible."));

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader
        title="Cotation" subtitle="Offres compagnies pour un client — garanties, plafonds et décompte de prime" icon={Calculator}
        actions={<Btn variant="secondary" onClick={voirReseauSoins}><MapPinned className="w-4 h-4" />Réseau de soins</Btn>}
      />

      {aoHandoffNom && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12.5px] text-foreground">
          Cotation pour l'appel d'offres <span className="font-semibold">{aoHandoffNom}</span>
        </div>
      )}

      {editingId && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-foreground flex items-center justify-between">
          <span>Modification de la cotation <span className="font-semibold">{editingId}</span> — enregistrez ou annulez avant d'en créer une nouvelle.</span>
          <button type="button" onClick={handleAnnulerModification} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Compagnie</label>
              <Combobox
                options={compagnies}
                value={compagnies.find((c) => c.id === ligne.compagnieId) ?? null}
                onChange={(c) => handleCompagnieChange(c?.id ?? "")}
                getLabel={(c) => c.nom} getId={(c) => c.id}
                placeholder="Rechercher…"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Branche</label>
              <select className={inputClass} value={ligne.branche} onChange={(e) => handleBrancheChange(e.target.value)}>
                <option>Maladie</option>
                <option>Assistance</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Appel d'offres (optionnel)</label>
              <select className={inputClass} value={ligne.appelOffresId ?? ""} onChange={(e) => handleAoChange(e.target.value)}>
                <option value="">— Aucun —</option>
                {appelsOffres.map((ao) => <option key={ao.id} value={ao.id}>{ao.id} · {ao.clientNom}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Client</label>
              <input
                className={inputClass} value={ligne.clientNom} disabled={!!appelOffresSelectionne}
                onChange={(e) => set("clientNom", e.target.value)} placeholder="Nom du client / prospect"
              />
              {appelOffresSelectionne && (
                <p className="text-[11px] text-muted-foreground">Nom reporté depuis le prospect de l'appel d'offres {appelOffresSelectionne.id}.</p>
              )}
            </div>
            <div className="col-span-2 flex items-center gap-3 -mt-1 p-2.5 rounded-lg border border-dashed border-border bg-secondary/20">
              {(() => {
                const url = appelOffresSelectionne
                  ? prospectLogoUrl(appelOffresSelectionne.prospect.logo)
                  : editingId ? cotationLogoUrl(editingLogo) : (pendingLogoPreview ?? undefined);
                return url
                  ? <img src={url} alt="" className="w-12 h-12 rounded-lg object-contain bg-white border border-border flex-shrink-0" />
                  : (
                    <div className="w-12 h-12 rounded-lg bg-secondary/40 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  );
              })()}
              {appelOffresSelectionne ? (
                // Client rattaché à un appel d'offres : le logo vit sur son
                // Prospect (voir écran CRM), upload immédiat.
                <>
                  <div className="flex items-center gap-2">
                    <label className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5" />{uploadingProspectLogo ? "Import…" : "Logo du client"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingProspectLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadProspectLogo(f); e.target.value = ""; }} />
                    </label>
                    {appelOffresSelectionne.prospect.logo && (
                      <button type="button" onClick={handleDeleteProspectLogo} className="text-[11.5px] text-muted-foreground hover:text-destructive">Retirer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Sans logo, le nom du client fait office de logo sur le document.</p>
                </>
              ) : editingId ? (
                // Cotation existante sans appel d'offres : le logo vit
                // directement sur la cotation, upload immédiat possible.
                <>
                  <div className="flex items-center gap-2">
                    <label className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5" />{uploadingCotationLogo ? "Import…" : "Logo du client"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingCotationLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadCotationLogoImmediat(f); e.target.value = ""; }} />
                    </label>
                    {editingLogo && (
                      <button type="button" onClick={handleDeleteCotationLogoImmediat} className="text-[11.5px] text-muted-foreground hover:text-destructive">Retirer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Sans logo, le nom du client fait office de logo sur le document.</p>
                </>
              ) : (
                // Nouvelle cotation, client en texte libre : la cotation
                // n'existe pas encore, le fichier est mis en attente et
                // importé automatiquement à l'enregistrement.
                <>
                  <div className="flex items-center gap-2">
                    <label className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5" />{pendingLogoFile ? "Changer le logo" : "Logo du client"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelectPendingLogo(f); e.target.value = ""; }} />
                    </label>
                    {pendingLogoFile && (
                      <button type="button" onClick={handleRemovePendingLogo} className="text-[11.5px] text-muted-foreground hover:text-destructive">Retirer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {pendingLogoFile ? "Sera importé à l'enregistrement de la cotation." : "Sans logo, le nom du client fait office de logo sur le document."}
                  </p>
                </>
              )}
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Population</label>
              <input type="number" className={inputClass} value={ligne.population} onChange={(e) => set("population", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Territorialité</label>
              <select
                className={inputClass} value={ligne.territorialite}
                onChange={(e) => set("territorialite", e.target.value)}
                disabled={!compagnieSelectionnee || compagnieSelectionnee.territorialites.length === 0}
              >
                <option value="">
                  {compagnieSelectionnee
                    ? compagnieSelectionnee.territorialites.length > 0 ? `— Territorialités de ${compagnieSelectionnee.nom} —` : "Aucune territorialité paramétrée pour cette compagnie"
                    : "— Sélectionnez une compagnie —"}
                </option>
                {compagnieSelectionnee?.territorialites.map((t) => <option key={t.id} value={t.libelle}>{t.libelle}</option>)}
                {/* La valeur courante peut provenir d'un pré-remplissage ou d'une saisie antérieure hors liste — on l'ajoute pour ne jamais perdre la sélection affichée. */}
                {ligne.territorialite && !compagnieSelectionnee?.territorialites.some((t) => t.libelle === ligne.territorialite) && (
                  <option value={ligne.territorialite}>{ligne.territorialite}</option>
                )}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Taux de couverture / Barème de prestations</label>
              <select
                className={inputClass} value=""
                onChange={(e) => {
                  const t = compagnieSelectionnee?.tauxCouverture.find((x) => x.id === e.target.value);
                  if (!t) return;
                  set("tauxCouvertureAmbulatoire", t.tauxAmbulatoire);
                  set("tauxCouvertureHospitalisation", t.tauxHospitalisation);
                }}
                disabled={!compagnieSelectionnee || compagnieSelectionnee.tauxCouverture.length === 0}
              >
                <option value="">
                  {compagnieSelectionnee
                    ? compagnieSelectionnee.tauxCouverture.length > 0 ? "— Appliquer un taux de couverture suggéré —" : "Aucun barème paramétré pour cette compagnie"
                    : "— Sélectionnez une compagnie —"}
                </option>
                {compagnieSelectionnee?.tauxCouverture.map((t) => (
                  <option key={t.id} value={t.id}>{t.tauxHospitalisation} HOSPITALISATION — {t.tauxAmbulatoire} AMBULATOIRES</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="space-y-1">
                  <label className="text-[10.5px] text-muted-foreground">Ambulatoire</label>
                  <select className={inputClass} value={ligne.tauxCouvertureAmbulatoire ?? ""} onChange={(e) => set("tauxCouvertureAmbulatoire", e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {TAUX_COUVERTURE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10.5px] text-muted-foreground">Hospitalisation</label>
                  <select className={inputClass} value={ligne.tauxCouvertureHospitalisation ?? ""} onChange={(e) => set("tauxCouvertureHospitalisation", e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {TAUX_COUVERTURE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Plafond familial (FCFA)</label>
              <input type="number" className={inputClass} value={ligne.plafondFamilial ?? 0} onChange={(e) => set("plafondFamilial", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Conditions de fermeté</label>
              <input className={inputClass} value={ligne.conditionsFermete ?? ""} onChange={(e) => set("conditionsFermete", e.target.value)} placeholder="ex. Sous réserve de l'examen médical" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Limite d'âge adulte</label>
              <input type="number" className={inputClass} value={ligne.limiteAgeAdulte ?? 0} onChange={(e) => set("limiteAgeAdulte", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Limite d'âge enfant</label>
              <input type="number" className={inputClass} value={ligne.limiteAgeEnfant ?? 0} onChange={(e) => set("limiteAgeEnfant", Number(e.target.value))} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Exclusions</label>
              <input className={inputClass} value={ligne.exclusions ?? ""} onChange={(e) => set("exclusions", e.target.value)} placeholder="ex. Pathologies antérieures à la souscription" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Clause d'ajustement</label>
              <textarea className={inputClass} rows={2} value={ligne.clauseAjustement ?? ""} onChange={(e) => set("clauseAjustement", e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>Garanties et plafonds</label>
              <button type="button" onClick={() => set("garanties", [...ligne.garanties, { categorie: "", libelle: "", plafond: "", tauxStructurePrivee: "", tauxStructurePublique: "" }])} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />Ajouter une garantie
              </button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 text-[10.5px] text-muted-foreground uppercase bg-secondary/30">
                    <th className="text-left px-3 py-1.5">Catégorie</th>
                    <th className="text-left px-3 py-1.5">Libellé</th>
                    <th className="text-left px-3 py-1.5">Structure privée</th>
                    <th className="text-left px-3 py-1.5">Structure publique</th>
                    <th className="text-left px-3 py-1.5">Plafond (si pas de distinction)</th>
                    <th className="px-2 py-1.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {ligne.garanties.map((g, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1"><input value={g.categorie} onChange={(e) => set("garanties", ligne.garanties.map((x, idx) => idx === i ? { ...x, categorie: e.target.value } : x))} className={inputClass} /></td>
                      <td className="px-2 py-1"><input value={g.libelle} onChange={(e) => set("garanties", ligne.garanties.map((x, idx) => idx === i ? { ...x, libelle: e.target.value } : x))} className={inputClass} /></td>
                      <td className="px-2 py-1"><input value={g.tauxStructurePrivee ?? ""} onChange={(e) => set("garanties", ligne.garanties.map((x, idx) => idx === i ? { ...x, tauxStructurePrivee: e.target.value } : x))} className={inputClass} placeholder="ex. 100% du barème" /></td>
                      <td className="px-2 py-1"><input value={g.tauxStructurePublique ?? ""} onChange={(e) => set("garanties", ligne.garanties.map((x, idx) => idx === i ? { ...x, tauxStructurePublique: e.target.value } : x))} className={inputClass} placeholder="ex. 100% des frais réels" /></td>
                      <td className="px-2 py-1"><input value={g.plafond} onChange={(e) => set("garanties", ligne.garanties.map((x, idx) => idx === i ? { ...x, plafond: e.target.value } : x))} className={inputClass} placeholder="ex. 400 000 FCFA" /></td>
                      <td className="px-2 py-1 text-center"><button type="button" onClick={() => set("garanties", ligne.garanties.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                  {ligne.garanties.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-center text-muted-foreground text-[11.5px]">Aucune garantie — sélectionnez une compagnie pour pré-remplir, ou ajoutez-en manuellement.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Structure privée/publique : à remplir seulement quand le taux diffère selon le type d'établissement ; sinon utiliser uniquement Plafond.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <label className={labelClass}>Prime NETTE / personne (FCFA)</label>
              <input type="number" className={inputClass} value={primeNetteParPersonne} onChange={(e) => setPrimeNetteParPersonne(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Carte / personne (FCFA)</label>
              <input type="number" className={inputClass} value={carteParPersonne} onChange={(e) => setCarteParPersonne(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Accessoires (FCFA, forfait)</label>
              <input type="number" className={inputClass} value={ligne.montantAccessoires} onChange={(e) => set("montantAccessoires", Number(e.target.value))} />
            </div>
          </div>

          {editingId ? (
            <div className="flex items-center gap-2">
              <Btn variant="primary" onClick={handleEnregistrerModification} disabled={submitting} className="justify-center flex-1">
                <Save className="w-4 h-4" />{submitting ? "Enregistrement…" : "Enregistrer les modifications"}
              </Btn>
              <Btn variant="secondary" onClick={handleAnnulerModification} className="justify-center">
                <X className="w-4 h-4" />Annuler
              </Btn>
            </div>
          ) : (
            <Btn variant="secondary" onClick={handleAjouterOffre} className="justify-center w-full">
              <PackagePlus className="w-4 h-4" />Ajouter cette offre à la cotation
            </Btn>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 h-fit">
          <h3 className="font-semibold text-foreground text-sm mb-3">Décompte de prime (offre en cours)</h3>
          <div className="space-y-2.5">
            {[
              { label: "Prime NETTE", value: primeNetteTotale },
              { label: "Cartes", value: montantCartesTotal },
              { label: "Accessoires", value: ligne.montantAccessoires },
              { label: "Taxe 8%", value: montantTaxe },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-foreground med-num">{fmtM(r.value)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Prime TTC</span>
              <span className="text-lg font-bold text-primary med-num">{fmtM(primeTTC)}</span>
            </div>
            {ligne.population > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Prime nette par personne</span>
                <span className="font-semibold text-foreground med-num">{fmtM(primeNetteParPersonne)} FCFA</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {!editingId && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground text-sm">Offres de cette cotation ({lignesEnAttente.length})</h3>
            <Btn variant="primary" onClick={handleEnregistrer} disabled={submitting || lignesEnAttente.length === 0}>
              <Save className="w-4 h-4" />{submitting ? "Enregistrement…" : `Enregistrer la cotation (${lignesEnAttente.length})`}
            </Btn>
          </div>
          <div className="space-y-1.5">
            {lignesEnAttente.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{compagnieNomLigne(l)}</span>
                  <Badge variant="gold">{l.branche}</Badge>
                  <span className="text-muted-foreground">{l.clientNom} · {l.population} pers.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground med-num">{fmtM(l.primeNette + l.montantCartes + l.montantAccessoires)} FCFA net</span>
                  <button type="button" onClick={() => handleRetirerLigne(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            {lignesEnAttente.length === 0 && <p className="text-[12px] text-muted-foreground text-center py-3">Aucune offre ajoutée — une cotation peut regrouper plusieurs compagnies et branches pour le même client, ajoutées une à une ci-dessus.</p>}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Cotations enregistrées</h3>
          {selectionHistorique.length > 0 && (
            <button type="button" onClick={() => voirDocument(selectionHistorique)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"><FileDown className="w-3.5 h-3.5" />Voir le document combiné ({selectionHistorique.length})</button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 w-8" />
              {["Réf.", "Client", "Compagnie", "Branche", "Population", "Prime TTC", "Appel d'offres", "Date", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cotations.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3"><input type="checkbox" checked={selectionHistorique.includes(c.id)} onChange={() => toggleSelectionHistorique(c.id)} className="w-3.5 h-3.5 accent-primary" /></td>
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap med-num">{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.clientNom}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.compagnie?.nom ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.branche}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap med-num">{c.population}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap med-num">{fmtM(c.primeTTC)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap med-num">{c.appelOffresId ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">{c.dateCreation}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleModifierCotation(c)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />Modifier</button>
                    <button type="button" onClick={() => voirDocumentDuDossier(c)} className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1"><FileDown className="w-3.5 h-3.5" />Document</button>
                  </div>
                </td>
              </tr>
            ))}
            {cotations.length === 0 && (
              <tr><td colSpan={10} className="py-10 text-center text-muted-foreground text-sm">Aucune cotation enregistrée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  QrCode, UserPlus, UserCheck, Plus, Lock, Unlock, Pencil, Phone, User,
  CreditCard, Receipt, ClipboardCheck, History, PauseCircle, PlayCircle, UserMinus, Eye,
  Trash2, ChevronDown, ChevronUp, ArrowRightLeft, FileSearch, Pill, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { StatCard } from "@/components/shared/StatCard";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { calculerAge } from "@/lib/age";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  getAssuresSante, rechercherAssuresSante, createAssure, updateAssure, uploadAssurePhoto, deleteAssurePhoto, toggleCarteAssure,
  suspendreAssure, retirerDuContratAssure, basculerAssure, getMouvementsAssure, getPriseEnCharges,
  assurePhotoUrl, ConflitFamilleError,
  type AssureUpsertInput, type UpdateAssureInput,
} from "@/services/sante.service";
import { openCarteAssurance, openFeuilleExamen, openFeuilleSoins } from "@/services/documents.service";
import { getContrats } from "@/services/contrats.service";
import type { AssureSante, PriseEnCharge, MouvementAssure } from "@/types/sante";
import type { Contrat } from "@/types/contrats";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const sectionCls = "text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 mt-5 first:mt-0";
const TYPES_ASSURE_FILTRE = [{ id: "AS", libelle: "Assuré principal" }, { id: "CJ", libelle: "Conjoint" }, { id: "EF", libelle: "Enfant" }];
const STATUTS_ASSURE_FILTRE = [{ id: "Actif", libelle: "Actif" }, { id: "Suspendu", libelle: "Suspendu" }, { id: "Radié", libelle: "Radié" }];

function emptyForm(): AssureUpsertInput {
  return { nom: "", contratId: "", beneficiaires: 0, cotisation: 0, dateAffiliation: new Date().toLocaleDateString("fr-FR"), typeAssure: "AS" };
}

function emptyAyantForm() {
  return { nom: "", prenom: "", typeAssure: "CJ" as "CJ" | "EF", dateNaissance: "", scolarise: false };
}

// Création avec gestion du conflit téléphone (409) : un CJ/EF dont le
// numéro correspond à une famille déjà connue nécessite une confirmation
// explicite avant rattachement — un assuré principal en conflit est lui
// refusé sans recours possible (400, remonté tel quel par l'appelant).
async function creerAvecConfirmation(payload: AssureUpsertInput): Promise<AssureSante> {
  try {
    return await createAssure(payload);
  } catch (err) {
    if (err instanceof ConflitFamilleError) {
      const ok = window.confirm(`${err.message}\n\nConfirmer le rattachement à cette famille ?`);
      if (!ok) throw new Error("Ajout annulé.");
      return createAssure({ ...payload, confirmerFamilleExistante: true });
    }
    throw err;
  }
}


const CATEGORIE_LABEL: Record<string, string> = { AS: "Assuré Principal", CJ: "Conjoint", EF: "Enfant" };

function Avatar({ photo, taille = 32 }: { photo?: string; taille?: number }) {
  const url = assurePhotoUrl(photo);
  return url
    ? <img src={url} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: taille, height: taille }} />
    : (
      <div className="rounded-full bg-secondary/60 flex items-center justify-center flex-shrink-0" style={{ width: taille, height: taille }}>
        <User className="text-muted-foreground" style={{ width: taille * 0.55, height: taille * 0.55 }} />
      </div>
    );
}

const MOTIFS_RETRAIT = ["Départ employé", "Décès", "Retraite", "Autre"] as const;
const TABS = [
  { id: "infos", label: "Informations" },
  { id: "carte", label: "Carte" },
  { id: "consommations", label: "Consommations" },
  { id: "statut", label: "Statut & mouvements" },
] as const;
type TabId = typeof TABS[number]["id"];

export default function ParticipantsView() {
  const { shellActionRequest, scrollToTop } = useShellNavigation();
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [selected, setSelected] = useState<AssureSante | null>(null);
  const [contrats, setContrats] = useState<Contrat[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<AssureUpsertInput>(emptyForm());
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showAjoutAyant, setShowAjoutAyant] = useState(false);
  const [ayantForm, setAyantForm] = useState(emptyAyantForm());
  const [ayantSubmitting, setAyantSubmitting] = useState(false);
  const [ayantError, setAyantError] = useState<string | null>(null);

  // Tiroir "Profil" — remplace l'ancien modal "Modifier" : c'est désormais
  // le point d'entrée unique pour tout ce qui concerne une personne (fiche,
  // carte, consommations, statut/mouvements), à onglets.
  const [showProfil, setShowProfil] = useState(false);
  const [profilTab, setProfilTab] = useState<TabId>("infos");
  const [editForm, setEditForm] = useState<UpdateAssureInput>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [pec, setPec] = useState<PriseEnCharge[]>([]);
  const [pecLoading, setPecLoading] = useState(false);
  const [pecOuvert, setPecOuvert] = useState<string | null>(null);

  const [mouvements, setMouvements] = useState<MouvementAssure[]>([]);
  const [mouvementsLoading, setMouvementsLoading] = useState(false);
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [showRetraitForm, setShowRetraitForm] = useState(false);
  const [retraitForm, setRetraitForm] = useState({ dateEffet: new Date().toLocaleDateString("fr-FR"), motif: MOTIFS_RETRAIT[0] as string });
  const [retraitSubmitting, setRetraitSubmitting] = useState(false);
  const [retraitError, setRetraitError] = useState<string | null>(null);

  const [showBasculeForm, setShowBasculeForm] = useState(false);
  const [basculeForm, setBasculeForm] = useState({ contratDestinationId: "", avecFamille: true, dateEffet: new Date().toLocaleDateString("fr-FR") });
  const [basculeSubmitting, setBasculeSubmitting] = useState(false);
  const [basculeError, setBasculeError] = useState<string | null>(null);

  // Recherche avancée (2026-09 — voir demande utilisateur : "ajouter des
  // filtres de recherche avancée dans l'onglet... participant... prenant
  // en compte plusieurs facteurs de recherche et le bouton de recherche")
  // — voir SanteService.findAssures pour la logique côté serveur (relève
  // les lignes qui matchent PUIS recharge leur famille entière, jamais un
  // ayant droit affiché orphelin de son assuré principal).
  const [filtreContratId, setFiltreContratId] = useState("");
  const [filtreNom, setFiltreNom] = useState("");
  const [filtreMatricule, setFiltreMatricule] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [recherchant, setRecherchant] = useState(false);

  const refresh = () => {
    setRecherchant(true);
    const filtres = { contratId: filtreContratId || undefined, nom: filtreNom.trim() || undefined, matricule: filtreMatricule.trim() || undefined, typeAssure: filtreType || undefined, statut: filtreStatut || undefined };
    const aDesCriteres = Object.values(filtres).some(Boolean);
    (aDesCriteres ? rechercherAssuresSante(filtres) : getAssuresSante())
      .then((data) => {
        setAssures(data);
        setSelected((s) => data.find((a) => a.id === s?.id) ?? data.find((a) => !a.familleId) ?? null);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Recherche impossible."))
      .finally(() => setRecherchant(false));
  };

  useEffect(() => {
    refresh();
    getContrats().then(setContrats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const racines = assures.filter((a) => !a.familleId);
  const racineDe = (a: AssureSante) => (a.familleId ? assures.find((x) => x.id === a.familleId) ?? null : a);
  const racineSelected = selected ? racineDe(selected) : null;
  const membresFamille = racineSelected ? assures.filter((a) => a.familleId === racineSelected.id) : [];
  const estRacineSelectionnee = !!selected && !selected.familleId;

  const openCreate = () => {
    setForm(emptyForm());
    setCreatePhoto(null);
    setFormError(null);
    setShowCreate(true);
  };

  // Raccourci d'accès rapide depuis le bandeau (2026-08) — voir AdminShell.tsx.
  useEffect(() => {
    if (shellActionRequest?.view === "participants" && shellActionRequest.label === "Nouveau participant") openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellActionRequest]);

  const handleCreate = async () => {
    if (!form.nom || !form.contratId) {
      setFormError("Nom et contrat sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      const nouveau = await creerAvecConfirmation(form);
      if (createPhoto) {
        try { await uploadAssurePhoto(nouveau.id, createPhoto); }
        catch { toast.error("Assuré créé, mais l'envoi de la photo a échoué — réessayez depuis sa fiche."); }
      }
      setShowCreate(false);
      refresh();
      toast.success("Assuré affilié avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur d'affiliation.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAjoutAyant = () => {
    setAyantForm(emptyAyantForm());
    setAyantError(null);
    setShowAjoutAyant(true);
  };

  const handleAjoutAyant = async () => {
    if (!selected || !ayantForm.nom.trim()) {
      setAyantError("Le nom est obligatoire.");
      return;
    }
    try {
      setAyantSubmitting(true);
      await creerAvecConfirmation({
        nom: ayantForm.nom, prenom: ayantForm.prenom || undefined,
        contratId: selected.police, beneficiaires: 0, cotisation: 0,
        dateNaissance: ayantForm.dateNaissance || undefined,
        dateAffiliation: new Date().toLocaleDateString("fr-FR"),
        typeAssure: ayantForm.typeAssure, familleId: selected.id,
        scolarise: ayantForm.typeAssure === "EF" ? ayantForm.scolarise : undefined,
      });
      setShowAjoutAyant(false);
      refresh();
      toast.success("Ayant droit ajouté.");
    } catch (err) {
      setAyantError(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setAyantSubmitting(false);
    }
  };

  const openProfil = () => {
    if (!selected) return;
    setEditForm({
      nom: selected.nom,
      prenom: selected.prenom ?? "",
      telephone: !selected.familleId ? (selected.telephone ?? "") : undefined,
      dateNaissance: selected.dateNaissance ?? "",
      statutMatrimonial: selected.statutMatrimonial as UpdateAssureInput["statutMatrimonial"],
      sexe: selected.sexe as UpdateAssureInput["sexe"],
      scolarise: selected.scolarise ?? false,
      adresse: selected.adresse ?? "",
      nomJeuneFille: selected.nomJeuneFille ?? "",
      lieuNaissance: selected.lieuNaissance ?? "",
      email: selected.email ?? "",
      telephoneFixe: selected.telephoneFixe ?? "",
      autreNumero: selected.autreNumero ?? "",
      fax: selected.fax ?? "",
    });
    setEditError(null);
    setShowRetraitForm(false);
    setRetraitError(null);
    setPecOuvert(null);
    setProfilTab("infos");
    setShowProfil(true);
  };

  // La photo s'envoie immédiatement à la sélection du fichier (voir l'onglet
  // Informations, bouton "+ Télécharger") — "Enregistrer" ne porte donc que
  // sur les champs texte du formulaire.
  const handleEdit = async () => {
    if (!selected) return;
    try {
      setEditSubmitting(true);
      await updateAssure(selected.id, editForm);
      refresh();
      toast.success("Fiche mise à jour.");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!selected) return;
    try {
      await deleteAssurePhoto(selected.id);
      refresh();
      toast.success("Photo supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const handleGenererCarte = async (assureId: string) => {
    try {
      await openCarteAssurance(assureId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération de la carte impossible.");
    }
  };

  const handleFeuilleExamen = async (assureId: string) => {
    try {
      await openFeuilleExamen(assureId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération de la feuille d'examen impossible.");
    }
  };

  const handleFeuilleSoins = async (assureId: string) => {
    try {
      await openFeuilleSoins(assureId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération de la feuille de soins impossible.");
    }
  };

  const handleToggleCarte = async () => {
    if (!selected) return;
    try {
      await toggleCarteAssure(selected.id);
      refresh();
      toast.success(selected.statutCarte === "Bloquée" ? "Carte réactivée." : "Carte bloquée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  // Onglet Consommations — pour un Assuré Principal, cumule les PEC de toute
  // la famille (lui + ses ayants droit) en un seul appel serveur.
  useEffect(() => {
    if (!showProfil || profilTab !== "consommations" || !selected) return;
    const ids = estRacineSelectionnee ? [selected.id, ...membresFamille.map((m) => m.id)] : [selected.id];
    setPecLoading(true);
    getPriseEnCharges(ids).then(setPec).finally(() => setPecLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProfil, profilTab, selected?.id]);

  // Onglet Statut & mouvements — historique des avenants Incorporation/Retrait.
  useEffect(() => {
    if (!showProfil || profilTab !== "statut" || !selected) return;
    setMouvementsLoading(true);
    getMouvementsAssure(selected.id).then(setMouvements).finally(() => setMouvementsLoading(false));
  }, [showProfil, profilTab, selected?.id]);

  const handleSuspendre = async () => {
    if (!selected) return;
    const suspendre = selected.statut !== "Suspendu";
    try {
      setSuspendBusy(true);
      await suspendreAssure(selected.id, suspendre);
      refresh();
      toast.success(suspendre ? "Assuré suspendu." : "Assuré réactivé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setSuspendBusy(false);
    }
  };

  const handleConfirmerRetrait = async () => {
    if (!selected) return;
    try {
      setRetraitSubmitting(true);
      const radies = await retirerDuContratAssure(selected.id, retraitForm);
      setShowRetraitForm(false);
      refresh();
      toast.success(radies.length > 1 ? `${radies.length} personnes retirées du contrat (famille).` : "Assuré retiré du contrat.");
    } catch (err) {
      setRetraitError(err instanceof Error ? err.message : "Retrait impossible.");
    } finally {
      setRetraitSubmitting(false);
    }
  };

  const handleConfirmerBascule = async () => {
    if (!selected || !basculeForm.contratDestinationId) return;
    try {
      setBasculeSubmitting(true);
      await basculerAssure(selected.id, basculeForm);
      setShowBasculeForm(false);
      refresh();
      toast.success("Bascule effectuée — la fiche est conservée, l'historique de consommation de l'ancien contrat reste consultable.");
    } catch (err) {
      setBasculeError(err instanceof Error ? err.message : "Bascule impossible.");
    } finally {
      setBasculeSubmitting(false);
    }
  };

  const totalMontantPec = pec.reduce((s, p) => s + p.montant, 0);
  const totalResteACharge = pec.reduce((s, p) => s + (p.resteACharge ?? 0), 0);

  // Groupé par contrat puis par année (2026-08) — une bascule vers un
  // autre contrat (voir bouton "Basculer vers un autre contrat") ne perd
  // jamais l'historique de consommation de l'ancien contrat : ce
  // regroupement le rend simplement visible sans ambiguïté, ancien
  // "collège" et nouveau restant clairement distincts.
  const contratLabelById = new Map(contrats.map((c) => [c.id, `${c.numeroPolice || c.id} · ${c.client}`]));
  const pecGroupee = Array.from(
    pec.reduce((groups, p) => {
      const annee = p.date.slice(-4);
      const cle = `${p.contratId}__${annee}`;
      (groups.get(cle) ?? groups.set(cle, []).get(cle)!).push(p);
      return groups;
    }, new Map<string, PriseEnCharge[]>()),
  )
    .map(([cle, items]) => {
      const [contratId, annee] = cle.split("__");
      return { contratId, annee, items, total: items.reduce((s, p) => s + p.montant, 0) };
    })
    .sort((a, b) => (b.annee + b.contratId).localeCompare(a.annee + a.contratId));

  return (
    <div className="p-6">
      <ModuleHeader title="Participants" subtitle="Affiliation, cartes et ayants droit des assurés santé" icon={UserCheck}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle affiliation</Btn>}
      />

      <div className="bg-card border border-border rounded-xl mb-4">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Rechercher des participants</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <label className="block">
              <div className={labelCls}>Contrat</div>
              <Combobox
                options={contrats}
                value={contrats.find((c) => c.id === filtreContratId) ?? null}
                onChange={(c) => setFiltreContratId(c?.id ?? "")}
                getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
                allowClear clearLabel="Tous"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Nom ou prénom</div>
              <input value={filtreNom} onChange={(e) => setFiltreNom(e.target.value)} placeholder="ex. Ondo" className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>Matricule</div>
              <input value={filtreMatricule} onChange={(e) => setFiltreMatricule(e.target.value)} placeholder="ex. LRX-12345" className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>Type</div>
              <Combobox
                options={TYPES_ASSURE_FILTRE}
                value={TYPES_ASSURE_FILTRE.find((t) => t.id === filtreType) ?? null}
                onChange={(t) => setFiltreType(t?.id ?? "")}
                getLabel={(t) => t.libelle} getId={(t) => t.id}
                allowClear clearLabel="Tous"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Statut</div>
              <Combobox
                options={STATUTS_ASSURE_FILTRE}
                value={STATUTS_ASSURE_FILTRE.find((s) => s.id === filtreStatut) ?? null}
                onChange={(s) => setFiltreStatut(s?.id ?? "")}
                getLabel={(s) => s.libelle} getId={(s) => s.id}
                allowClear clearLabel="Tous"
              />
            </label>
          </div>
          <Btn variant="primary" onClick={refresh} disabled={recherchant}>
            <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Participants ({racines.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Assuré", "Matricule", "Ayants droit", "Cotisation/mois", "Carte", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {racines.map((a) => {
              const nbMembres = assures.filter((m) => m.familleId === a.id).length;
              return (
                <tr key={a.id} onClick={() => { setSelected(a); scrollToTop(); }}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${racineSelected?.id === a.id ? "bg-primary/8" : "hover:bg-secondary/30"}`}
                >
                  <td className="px-4 py-3 font-semibold text-foreground text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar photo={a.photo} taille={26} />
                      {a.nom} {a.prenom ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{a.matricule}</td>
                  <td className="px-4 py-3 text-center text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{nbMembres}</td>
                  <td className="px-4 py-3 text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.cotisation)}</td>
                  <td className="px-4 py-3"><Badge variant={a.statutCarte === "Bloquée" ? "danger" : "neutral"}>{a.statutCarte ?? "—"}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={a.statut === "Actif" ? "success" : a.statut === "Radié" ? "danger" : "warning"}>{a.statut}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar photo={selected.photo} taille={40} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">{selected.nom} {selected.prenom ?? ""}</h3>
                <p className="text-[11px] text-muted-foreground">{selected.familleId ? "Ayant droit" : "Assuré Principal"}</p>
              </div>
            </div>
            <Badge variant={selected.statut === "Actif" ? "success" : selected.statut === "Radié" ? "danger" : "warning"}>{selected.statut}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">N° assuré</p><p className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.numeroAssure ?? "—"}</p></div>
            <div><p className="text-muted-foreground">QR Code</p><p className="font-semibold text-foreground flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace" }}><QrCode className="w-3 h-3" />{selected.qrCode ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Date affiliation</p><p className="text-foreground">{selected.dateAffiliation ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Statut matrimonial</p><p className="text-foreground">{selected.statutMatrimonial ?? "—"}</p></div>
            <div className="col-span-2">
              <p className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />Téléphone {selected.familleId ? "(famille)" : ""}</p>
              <p className="text-foreground font-semibold">{racineSelected?.telephone ?? "—"}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Ayants droit ({membresFamille.length})</p>
              </div>
              {estRacineSelectionnee && (
                <button type="button" onClick={openAjoutAyant} className="text-[11px] text-primary hover:underline">+ Ajouter</button>
              )}
            </div>
            <div className="space-y-1.5">
              {membresFamille.map((m) => (
                <button key={m.id} type="button" onClick={() => { setSelected(m); scrollToTop(); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors ${selected.id === m.id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/30 hover:bg-secondary/50"}`}
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Avatar photo={m.photo} taille={22} />
                    {m.nom} {m.prenom ?? ""} <span className="text-muted-foreground">— {m.typeAssure === "CJ" ? "Conjoint" : "Enfant"}</span>
                  </span>
                  <Badge variant={m.statut === "Actif" ? "success" : m.statut === "Radié" ? "danger" : "warning"}>{m.statut}</Badge>
                </button>
              ))}
              {membresFamille.length === 0 && <p className="text-xs text-muted-foreground">Aucun ayant droit déclaré</p>}
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <Btn variant="primary" className="flex-1 justify-center" onClick={openProfil}><Pencil className="w-4 h-4" />Voir le profil</Btn>
            <Btn variant="secondary" onClick={() => handleGenererCarte(selected.id)}><CreditCard className="w-4 h-4" />Carte</Btn>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 h-fit flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">Sélectionnez un assuré pour voir le détail d'affiliation</p>
        </div>
      )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle affiliation</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5">
              <p className={sectionCls}>Identité</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Nom</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Prénom</div><input value={form.prenom ?? ""} onChange={(e) => setForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date de naissance</div><DateInput value={form.dateNaissance ?? ""} onChange={(v) => setForm((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
              </div>

              <p className={sectionCls}>Affiliation</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <div className="text-[12px] text-muted-foreground mb-1.5">Contrat (police collective)</div>
                  <Combobox
                    options={contrats}
                    value={contrats.find((c) => c.id === form.contratId) ?? null}
                    onChange={(c) => setForm((v) => ({ ...v, contratId: c?.id ?? "" }))}
                    getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Ayants droit (nombre)</div><input type="number" value={form.beneficiaires} onChange={(e) => setForm((v) => ({ ...v, beneficiaires: Number(e.target.value) }))} className={fieldCls} /></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Cotisation/mois (FCFA)</div><input type="number" value={form.cotisation} onChange={(e) => setForm((v) => ({ ...v, cotisation: Number(e.target.value) }))} className={fieldCls} /></label>
              </div>

              <p className={sectionCls}>Contact & état civil</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Téléphone (famille)</div><input value={form.telephone ?? ""} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} placeholder="+241 ..." /></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Statut matrimonial</div><select value={form.statutMatrimonial ?? ""} onChange={(e) => setForm((v) => ({ ...v, statutMatrimonial: e.target.value as AssureUpsertInput["statutMatrimonial"] }))} className={fieldCls}><option value="">—</option><option>Célibataire</option><option>Marié</option><option>Divorcé</option><option>Veuf</option></select></label>
              </div>

              <p className={sectionCls}>Photo</p>
              {/* Pas d'attribut `accept` (2026-09) — voir demande
                  utilisateur : "le système puisse lire tout type de fichier".
                  Un premier essai avec "image/*" + extensions explicites
                  masquait encore certains fichiers .png dans le sélecteur
                  sur ce poste (détection MIME/association de fichier peu
                  fiable) — supprimé purement et simplement : le backend
                  accepte de toute façon n'importe quelle extension (voir
                  SanteService.uploadPhoto). */}
              <input type="file" onChange={(e) => setCreatePhoto(e.target.files?.[0] ?? null)} className="w-full text-[13px] text-foreground" />
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Affilier</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAjoutAyant && selected && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Ajouter un ayant droit — famille {selected.nom}</h3>
              <button type="button" onClick={() => setShowAjoutAyant(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5">
              <p className={sectionCls}>Identité</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Nom</div><input value={ayantForm.nom} onChange={(e) => setAyantForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Prénom</div><input value={ayantForm.prenom} onChange={(e) => setAyantForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
              </div>
              <p className={sectionCls}>Lien de parenté & naissance</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Lien</div><select value={ayantForm.typeAssure} onChange={(e) => setAyantForm((v) => ({ ...v, typeAssure: e.target.value as "CJ" | "EF" }))} className={fieldCls}><option value="CJ">Conjoint</option><option value="EF">Enfant</option></select></label>
                <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date de naissance</div><DateInput value={ayantForm.dateNaissance} onChange={(v) => setAyantForm((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
              </div>
              {ayantForm.typeAssure === "EF" && (
                <label className="flex items-center gap-2 mt-3">
                  <input type="checkbox" checked={ayantForm.scolarise} onChange={(e) => setAyantForm((v) => ({ ...v, scolarise: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  <span className="text-[13px] text-foreground">Enfant scolarisé (limite d'âge étendue du contrat)</span>
                </label>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">Le téléphone de cette personne est celui de la famille ({racineDe(selected)?.telephone ?? "non renseigné"}) — non modifiable individuellement.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{ayantError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowAjoutAyant(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={ayantSubmitting} onClick={handleAjoutAyant} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Ajouter</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfil && selected && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Avatar photo={selected.photo} taille={32} />
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">{selected.nom} {selected.prenom ?? ""}</h3>
                  <p className="text-[11px] text-muted-foreground">{selected.matricule} · {selected.familleId ? "Ayant droit" : "Assuré Principal"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowProfil(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>

            <div className="px-5 pt-3 border-b border-border flex items-center gap-1 flex-shrink-0 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.id} type="button" onClick={() => setProfilTab(t.id)}
                  className={`px-3 py-2 text-[12.5px] font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap transition-colors ${profilTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {profilTab === "infos" && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
                  <div>
                    <p className={sectionCls}>Identité</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Sexe</div><select value={editForm.sexe ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, sexe: e.target.value as UpdateAssureInput["sexe"] }))} className={fieldCls}><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option></select></label>
                      <div className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Catégorie de l'assuré</div><p className="text-[13px] text-foreground px-3 py-2">{selected.typeAssure ? CATEGORIE_LABEL[selected.typeAssure] ?? selected.typeAssure : "—"}</p></div>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Prénom</div><input value={editForm.prenom ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Nom</div><input value={editForm.nom ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Statut marital</div><select value={editForm.statutMatrimonial ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, statutMatrimonial: e.target.value as UpdateAssureInput["statutMatrimonial"] }))} className={fieldCls}><option value="">Sélectionnez</option><option>Célibataire</option><option>Marié</option><option>Divorcé</option><option>Veuf</option></select></label>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Nom de jeune fille</div><input value={editForm.nomJeuneFille ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, nomJeuneFille: e.target.value }))} className={fieldCls} /></label>
                    </div>

                    <p className={sectionCls}>Naissance & adresse</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date de naissance</div><DateInput value={editForm.dateNaissance ?? ""} onChange={(v) => setEditForm((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
                      <div className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Âge (ans)</div><p className="text-[13px] text-foreground px-3 py-2">{calculerAge(editForm.dateNaissance) ?? "—"}</p></div>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Lieu de naissance</div><input value={editForm.lieuNaissance ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, lieuNaissance: e.target.value }))} className={fieldCls} /></label>
                      {selected.typeAssure === "EF" && (
                        <label className="flex items-center gap-2 md:col-span-2 pt-1">
                          <input type="checkbox" checked={editForm.scolarise ?? false} onChange={(e) => setEditForm((v) => ({ ...v, scolarise: e.target.checked }))} className="w-4 h-4 accent-primary" />
                          <span className="text-[13px] text-foreground">Enfant scolarisé (limite d'âge étendue du contrat)</span>
                        </label>
                      )}
                      <label className="block md:col-span-2"><div className="text-[12px] text-muted-foreground mb-1.5">Adresse</div><input value={editForm.adresse ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
                    </div>

                    <p className={sectionCls}>Identification & coordonnées</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Matricule</div><p className="text-[13px] text-foreground px-3 py-2" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.matricule}</p></div>
                      <div className="block"><div className="text-[12px] text-muted-foreground mb-1.5">N° Assuré</div><p className="text-[13px] text-foreground px-3 py-2" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.numeroAssure ?? "—"}</p></div>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Email</div><input type="email" value={editForm.email ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                      {!selected.familleId ? (
                        <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Numéro mobile (famille)</div><input value={editForm.telephone ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
                      ) : (
                        <div className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Numéro mobile (famille)</div><p className="text-[13px] text-muted-foreground px-3 py-2">Porté par l'assuré principal — {racineSelected?.telephone ?? "non renseigné"}</p></div>
                      )}
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Numéro fixe</div><input value={editForm.telephoneFixe ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, telephoneFixe: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Autre numéro</div><input value={editForm.autreNumero ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, autreNumero: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">N° Fax</div><input value={editForm.fax ?? ""} onChange={(e) => setEditForm((v) => ({ ...v, fax: e.target.value }))} className={fieldCls} /></label>
                    </div>

                    <div className="flex items-center justify-between pt-5 mt-5 border-t border-border">
                      <div className="text-[12px] text-destructive">{editError ?? ""}</div>
                      <button type="button" disabled={editSubmitting} onClick={handleEdit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
                    </div>
                  </div>

                  <div>
                    <p className={sectionCls}>Photo</p>
                    <div className="border border-border rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Maximum : 1 Mo</span>
                      </div>
                      <div className="w-full aspect-square rounded-lg overflow-hidden bg-secondary/40 flex items-center justify-center">
                        {assurePhotoUrl(selected.photo)
                          ? <img src={assurePhotoUrl(selected.photo)} alt="" className="w-full h-full object-cover" />
                          : <User className="w-12 h-12 text-muted-foreground" />}
                      </div>
                      <label className="block">
                        <input type="file" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (!file) return;
                          try { await uploadAssurePhoto(selected.id, file); refresh(); toast.success("Photo mise à jour."); }
                          catch (err) { toast.error(err instanceof Error ? err.message : "Envoi de la photo impossible."); }
                        }} />
                        <span className="block text-center h-9 leading-9 rounded-lg bg-emerald-600 text-white text-[13px] font-medium cursor-pointer hover:opacity-90">+ Télécharger</span>
                      </label>
                      {selected.photo && (
                        <button type="button" onClick={handleDeletePhoto} className="w-full h-9 rounded-lg bg-destructive text-destructive-foreground text-[13px] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" />Supprimer la photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {profilTab === "carte" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar photo={selected.photo} taille={64} />
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <div><p className="text-muted-foreground">N° assuré</p><p className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.numeroAssure ?? "—"}</p></div>
                      <div><p className="text-muted-foreground">QR Code</p><p className="font-semibold text-foreground flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace" }}><QrCode className="w-3 h-3" />{selected.qrCode ?? "—"}</p></div>
                      <div><p className="text-muted-foreground">Statut carte</p><Badge variant={selected.statutCarte === "Bloquée" ? "danger" : "success"}>{selected.statutCarte ?? "—"}</Badge></div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-border flex-wrap">
                    <Btn variant="primary" onClick={() => handleGenererCarte(selected.id)}><Eye className="w-4 h-4" />Aperçu / générer la carte</Btn>
                    <Btn variant="secondary" onClick={() => handleFeuilleExamen(selected.id)}><FileSearch className="w-4 h-4" />Feuille d'examen</Btn>
                    <Btn variant="secondary" onClick={() => handleFeuilleSoins(selected.id)}><Pill className="w-4 h-4" />Feuille de soins</Btn>
                    <Btn variant="secondary" onClick={handleToggleCarte}>
                      {selected.statutCarte === "Bloquée" ? <><Unlock className="w-4 h-4" />Réactiver la carte</> : <><Lock className="w-4 h-4" />Désactiver la carte</>}
                    </Btn>
                  </div>
                </div>
              )}

              {profilTab === "consommations" && (
                <div className="space-y-4">
                  {estRacineSelectionnee && membresFamille.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">Assuré principal — cumul des consommations de toute la famille ({membresFamille.length + 1} personnes).</p>
                  )}
                  {pecLoading && <p className="text-[12px] text-muted-foreground text-center py-8">Chargement…</p>}
                  {!pecLoading && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <StatCard title="Montant total" value={fmtM(totalMontantPec)} icon={Receipt} />
                        <StatCard title="Dossiers" value={String(pec.length)} icon={ClipboardCheck} />
                        <StatCard title="Reste à charge cumulé" value={fmtM(totalResteACharge)} icon={Receipt} accent="bg-amber-500/15" />
                      </div>
                      <div className="space-y-5">
                        {pecGroupee.map((groupe) => (
                          <div key={`${groupe.contratId}__${groupe.annee}`}>
                            <div className="flex items-center justify-between mb-2 px-1">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                {contratLabelById.get(groupe.contratId) ?? groupe.contratId} — {groupe.annee}
                              </p>
                              <p className="text-[11px] font-semibold text-foreground med-num">{fmtM(groupe.total)}</p>
                            </div>
                            <div className="space-y-2">
                              {groupe.items.map((p) => {
                                const ouvert = pecOuvert === p.id;
                                return (
                                  <div key={p.id} className="rounded-lg bg-secondary/30 overflow-hidden">
                                    <button type="button" onClick={() => setPecOuvert(ouvert ? null : p.id)} className="w-full text-left p-3 hover:bg-secondary/50 transition-colors">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            {ouvert ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                            <span className="text-[11px] font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{p.id}</span>
                                            <Badge variant={p.type === "Hospitalisation" ? "danger" : "neutral"}>{p.type}</Badge>
                                            {estRacineSelectionnee && membresFamille.length > 0 && <Badge variant="info">{p.assure}</Badge>}
                                          </div>
                                          <p className="text-xs text-muted-foreground pl-5">{p.prestataire} · {p.date}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.montant)}</p>
                                          <Badge variant={p.statut === "Remboursé" ? "success" : "info"}>{p.statut}</Badge>
                                        </div>
                                      </div>
                                    </button>
                                    {ouvert && (
                                      <div className="px-3 pb-3 pt-1 border-t border-border/60 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                                        <div><p className="text-muted-foreground">Mode de paiement</p><p className="text-foreground">{p.modePaiement === "TiersPayant" ? "Tiers payant" : p.modePaiement ?? "—"}</p></div>
                                        <div><p className="text-muted-foreground">Contrôle médical</p><p className="text-foreground">{p.statutControleMedical ?? "—"}</p></div>
                                        <div><p className="text-muted-foreground">Ordre de paiement</p><p className="text-foreground">{p.ordrePaiement ?? "—"}</p></div>
                                        <div><p className="text-muted-foreground">Base remboursement</p><p className="text-foreground">{p.baseRemboursement !== undefined ? fmtM(p.baseRemboursement) : "—"}</p></div>
                                        <div><p className="text-muted-foreground">Taux remboursement</p><p className="text-foreground">{p.tauxRemboursement !== undefined ? `${p.tauxRemboursement}%` : "—"}</p></div>
                                        <div><p className="text-muted-foreground">Franchise</p><p className="text-foreground">{p.franchise !== undefined ? fmtM(p.franchise) : "—"}</p></div>
                                        <div><p className="text-muted-foreground">Plafond appliqué</p><p className="text-foreground">{p.plafondApplique !== undefined ? fmtM(p.plafondApplique) : "—"}</p></div>
                                        <div><p className="text-muted-foreground">Reste à charge</p><p className="text-foreground">{p.resteACharge !== undefined ? fmtM(p.resteACharge) : "—"}</p></div>
                                        {p.motifRejet && <div className="col-span-2 md:col-span-3"><p className="text-muted-foreground">Motif de rejet</p><p className="text-destructive">{p.motifRejet}</p></div>}
                                        <div><p className="text-muted-foreground">Réf. prescription</p><p className="text-foreground">{p.prescriptionRef ?? "—"}</p></div>
                                        <div><p className="text-muted-foreground">Réf. facture</p><p className="text-foreground">{p.factureRef ?? "—"}</p></div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {pec.length === 0 && <p className="text-xs text-center text-muted-foreground py-8">Aucune prise en charge enregistrée.</p>}
                      </div>
                    </>
                  )}
                </div>
              )}

              {profilTab === "statut" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-muted-foreground mb-1">Statut actuel</p>
                      <Badge variant={selected.statut === "Actif" ? "success" : selected.statut === "Radié" ? "danger" : "warning"}>{selected.statut}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selected.statut !== "Radié" && (
                      <Btn variant="secondary" disabled={suspendBusy} onClick={handleSuspendre}>
                        {selected.statut === "Suspendu" ? <><PlayCircle className="w-4 h-4" />Réactiver</> : <><PauseCircle className="w-4 h-4" />Suspendre</>}
                      </Btn>
                    )}
                    <Btn variant="ghost" onClick={() => { setShowBasculeForm((v) => !v); setBasculeError(null); }}>
                      <ArrowRightLeft className="w-4 h-4" />Basculer vers un autre contrat
                    </Btn>
                    {selected.statut !== "Radié" && (
                      <Btn variant="ghost" onClick={() => { setShowRetraitForm((v) => !v); setRetraitError(null); }}>
                        <UserMinus className="w-4 h-4" />Retirer du contrat
                      </Btn>
                    )}
                  </div>

                  {showBasculeForm && (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                      <p className="text-[12px] text-foreground font-semibold">
                        {selected.statut === "Radié"
                          ? "Réactivation — cette personne redevient active sous le contrat destination (la fiche est conservée, jamais recréée). Génère un Retrait sur l'ancien contrat et une Incorporation sur le nouveau."
                          : "Bascule vers un autre contrat — la fiche est conservée (pas de recréation), l'historique de consommation de l'ancien contrat reste consultable. Génère un Retrait sur l'ancien contrat et une Incorporation sur le nouveau."}
                      </p>
                      {estRacineSelectionnee && membresFamille.length > 0 && (
                        <label className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                          <input type="checkbox" checked={basculeForm.avecFamille} onChange={(e) => setBasculeForm((f) => ({ ...f, avecFamille: e.target.checked }))} className="w-4 h-4 accent-primary" />
                          Basculer aussi ses {membresFamille.length} ayant(s) droit (sinon bascule individuelle — cette personne devient assuré principal de sa propre fiche dans le contrat destination)
                        </label>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <div className="text-[12px] text-muted-foreground mb-1.5">Contrat destination</div>
                          <select value={basculeForm.contratDestinationId} onChange={(e) => setBasculeForm((f) => ({ ...f, contratDestinationId: e.target.value }))} className={fieldCls}>
                            <option value="">— Sélectionner —</option>
                            {contrats.filter((c) => c.id !== selected.police).map((c) => <option key={c.id} value={c.id}>{c.numeroPolice ?? c.id} · {c.client}</option>)}
                          </select>
                        </label>
                        <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date d'effet</div><DateInput value={basculeForm.dateEffet} onChange={(v) => setBasculeForm((f) => ({ ...f, dateEffet: v }))} className={fieldCls} /></label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] text-destructive">{basculeError ?? ""}</div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowBasculeForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                          <button type="button" disabled={basculeSubmitting || !basculeForm.contratDestinationId} onClick={handleConfirmerBascule} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Confirmer la bascule</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showRetraitForm && (
                    <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
                      <p className="text-[12px] text-foreground font-semibold">Sortie définitive — impacte la prime du contrat et génère un avenant de retrait.</p>
                      {estRacineSelectionnee && membresFamille.length > 0 && (
                        <p className="text-[11.5px] text-destructive">Cette action retirera aussi ses {membresFamille.length} ayant(s) droit.</p>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date d'effet</div><DateInput value={retraitForm.dateEffet} onChange={(v) => setRetraitForm((f) => ({ ...f, dateEffet: v }))} className={fieldCls} /></label>
                        <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Motif</div>
                          <select value={retraitForm.motif} onChange={(e) => setRetraitForm((f) => ({ ...f, motif: e.target.value }))} className={fieldCls}>
                            {MOTIFS_RETRAIT.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] text-destructive">{retraitError ?? ""}</div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowRetraitForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                          <button type="button" disabled={retraitSubmitting} onClick={handleConfirmerRetrait} className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Confirmer le retrait</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Historique des mouvements</p>
                    </div>
                    {mouvementsLoading && <p className="text-[12px] text-muted-foreground text-center py-6">Chargement…</p>}
                    {!mouvementsLoading && (
                      <div className="space-y-1.5">
                        {mouvements.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-xs">
                            <div className="flex items-center gap-2">
                              <Badge variant={m.action === "Incorporation" ? "success" : "danger"}>{m.action}</Badge>
                              <span className="text-foreground">{m.dateEffet}</span>
                            </div>
                            <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{m.avenantId}</span>
                          </div>
                        ))}
                        {mouvements.length === 0 && <p className="text-xs text-muted-foreground">Aucun mouvement enregistré pour cette personne.</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

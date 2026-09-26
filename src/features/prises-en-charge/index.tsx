import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Pencil, FileText, Users, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { fmtM } from "@/lib/format";
import {
  getPriseEnCharges, createPriseEnCharge, updatePriseEnCharge, getAssuresSante,
  type PriseEnChargeUpsertInput,
} from "@/services/sante.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import { getFactures, createFacture, type FactureUpsertInput } from "@/services/factures.service";
import { getRemboursements, createRemboursement, type RemboursementUpsertInput } from "@/services/remboursements.service";
import { getPrestataires } from "@/services/prestataires.service";
import { getClients } from "@/services/clients.service";
import { getContrats } from "@/services/contrats.service";
import FactureSaisie from "./FactureSaisie";
import RemboursementSaisie from "./RemboursementSaisie";
import type { PriseEnCharge, AssureSante } from "@/types/sante";
import type { ActeMedical } from "@/types/acteMedical";
import type { Facture } from "@/types/facture";
import type { Remboursement } from "@/types/remboursement";
import type { Prestataire } from "@/types/prestataires";
import type { Client } from "@/types/clients";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

const controleMedicalVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "Validé": "success", "En cours": "warning", "Rejeté": "danger", "Non requis": "neutral",
};

// Catégorie du catalogue ActeMedical → type de soin le plus proche, pour
// pré-remplir le formulaire de remboursement dès qu'un acte est choisi.
const TYPE_PAR_CATEGORIE: Record<string, string> = {
  "Hospitalisation": "Hospitalisation",
  "Dentisterie": "Dentaire",
  "Consultation/Divers": "Consultation",
  "Kinésithérapie & Cure thermale": "Consultation",
};

const ONGLETS = [
  { id: "TiersPayant", label: "Factures" },
  { id: "Remboursement", label: "Remboursements" },
] as const;
type OngletId = (typeof ONGLETS)[number]["id"];

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const STATUTS_FACTURE = [{ id: "En saisie", libelle: "En saisie" }, { id: "Soumise", libelle: "Soumise" }, { id: "Annulée", libelle: "Annulée" }];

function emptyRemboursementForm(): PriseEnChargeUpsertInput {
  return { assureId: "", prestataire: "", type: "Consultation", montant: 0, date: new Date().toLocaleDateString("fr-FR"), modePaiement: "Remboursement" };
}

function emptyFactureHeaderForm() {
  return { prestataire: null as Prestataire | null, client: null as Client | null, contratId: "", dateReception: new Date().toLocaleDateString("fr-FR"), referenceFacture: "" };
}

// En-tête de déclaration de remboursement (2026-08) — voir demande
// utilisateur : "le remboursement ne se fait pas à l'ordre d'un
// prestataire, mais plutôt à l'ordre de l'assuré ou de son souscripteur...
// la saisie de remboursement se fait comme celle de la facture". Même
// esprit que emptyFactureHeaderForm ci-dessus, sans prestataire — un
// bénéficiaire (assuré principal OU souscripteur) à la place.
function emptyRembHeaderForm() {
  return {
    beneficiaire: "AssurePrincipal" as "AssurePrincipal" | "Souscripteur",
    assurePrincipal: null as AssureSante | null,
    client: null as Client | null, contratId: "",
    dateDeclaration: new Date().toLocaleDateString("fr-FR"),
  };
}

export default function PrisesEnChargeView() {
  const { shellActionRequest } = useShellNavigation();
  const [onglet, setOnglet] = useState<OngletId>("TiersPayant");

  // ── Factures (tiers payant) ──────────────────────────────────────────
  const [factures, setFactures] = useState<Facture[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [showCreateFacture, setShowCreateFacture] = useState(false);
  const [factureForm, setFactureForm] = useState(emptyFactureHeaderForm());
  const [factureSubmitting, setFactureSubmitting] = useState(false);
  const [factureOuverte, setFactureOuverte] = useState<string | null>(null);

  // Recherche avancée (2026-09 — voir demande utilisateur : "ajouter des
  // filtres de recherche avancée dans l'onglet... facture... prenant en
  // compte plusieurs facteurs de recherche et le bouton de recherche") —
  // même principe que l'écran Prise en charge (accord-prealable/index.tsx).
  const [filtrePrestataireId, setFiltrePrestataireId] = useState("");
  const [filtreClientId, setFiltreClientId] = useState("");
  const [filtreContratId, setFiltreContratId] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");
  const [filtreReference, setFiltreReference] = useState("");
  const [recherchant, setRecherchant] = useState(false);

  const filtresFacturesActuels = {
    prestataireId: filtrePrestataireId || undefined,
    clientId: filtreClientId || undefined,
    contratId: filtreContratId || undefined,
    statut: filtreStatut || undefined,
    du: filtreDu || undefined,
    au: filtreAu || undefined,
    reference: filtreReference.trim() || undefined,
  };

  const refreshFactures = async () => {
    setRecherchant(true);
    try {
      setFactures(await getFactures(filtresFacturesActuels));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => {
    getPrestataires().then(setPrestataires);
    getClients().then(setClients);
    getContrats().then(setContrats);
    refreshFactures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contratsDuFiltreClient = useMemo(
    () => (filtreClientId ? contrats.filter((c) => c.clientId === filtreClientId) : contrats),
    [contrats, filtreClientId],
  );

  const contratsDuClient = useMemo(
    () => (factureForm.client ? contrats.filter((c) => c.clientId === factureForm.client!.id) : []),
    [contrats, factureForm.client],
  );

  // Net à payer au prestataire (baseRemboursement - montantTps des lignes
  // actives), jamais les frais réels — voir feedback-montant-net-a-payer.
  const totalFacture = (f: Facture) => f.lignes.filter((l) => l.statut !== "Rejeté").reduce((s, l) => s + (l.baseRemboursement ?? 0) - (l.montantTps ?? 0), 0);

  const openCreateFacture = () => {
    setFactureForm(emptyFactureHeaderForm());
    setShowCreateFacture(true);
  };

  const handleCreateFacture = async () => {
    if (!factureForm.prestataire || !factureForm.client || !factureForm.contratId || !factureForm.referenceFacture.trim()) {
      toast.error("Prestataire, souscripteur, contrat et référence de la facture sont obligatoires.");
      return;
    }
    try {
      setFactureSubmitting(true);
      const payload: FactureUpsertInput = {
        prestataireId: factureForm.prestataire.id, contratId: factureForm.contratId,
        dateReception: factureForm.dateReception, referenceFacture: factureForm.referenceFacture.trim(),
      };
      const facture = await createFacture(payload);
      setShowCreateFacture(false);
      refreshFactures();
      setFactureOuverte(facture.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création de la facture impossible.");
    } finally {
      setFactureSubmitting(false);
    }
  };

  // ── Remboursements ────────────────────────────────────────────────────
  // Déclarations multi-lignes (2026-08) — voir demande utilisateur : "la
  // saisie de remboursement se fait comme celle de la facture... on doit
  // avoir le même écran de saisie de facture". `priseEnCharges` ci-dessous
  // reste réservé aux demandes AUTONOMES soumises depuis le portail assuré
  // (jamais rattachées à une déclaration, voir PortailMembreController.
  // creerRemboursement) — la déclaration multi-lignes vit dans `remboursements`.
  const [remboursements, setRemboursements] = useState<Remboursement[]>([]);
  const [showCreateRembHeader, setShowCreateRembHeader] = useState(false);
  const [rembHeaderForm, setRembHeaderForm] = useState(emptyRembHeaderForm());
  const [rembHeaderSubmitting, setRembHeaderSubmitting] = useState(false);
  const [remboursementOuvert, setRemboursementOuvert] = useState<string | null>(null);

  const [priseEnCharges, setPriseEnCharges] = useState<PriseEnCharge[]>([]);
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [showCreateRemb, setShowCreateRemb] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rembForm, setRembForm] = useState<PriseEnChargeUpsertInput>(emptyRemboursementForm());
  const [rembSubmitting, setRembSubmitting] = useState(false);
  const [rembFormError, setRembFormError] = useState<string | null>(null);

  // Recherche avancée (2026-09 — voir demande utilisateur : "quand on
  // parle de saisie de facture, les remboursements sont aussi concernés")
  // — même patron que les factures (tiers payant) ci-dessus.
  const [filtreRembClientId, setFiltreRembClientId] = useState("");
  const [filtreRembContratId, setFiltreRembContratId] = useState("");
  const [filtreRembAssurePrincipalId, setFiltreRembAssurePrincipalId] = useState("");
  const [filtreRembStatut, setFiltreRembStatut] = useState("");
  const [filtreRembDu, setFiltreRembDu] = useState("");
  const [filtreRembAu, setFiltreRembAu] = useState("");
  const [recherchantRemb, setRecherchantRemb] = useState(false);

  const refreshRemboursements = async () => {
    setRecherchantRemb(true);
    try {
      const [remb] = await Promise.all([
        getRemboursements({
          clientId: filtreRembClientId || undefined, contratId: filtreRembContratId || undefined,
          assurePrincipalId: filtreRembAssurePrincipalId || undefined, statut: filtreRembStatut || undefined,
          du: filtreRembDu || undefined, au: filtreRembAu || undefined,
        }),
        getPriseEnCharges().then((data) => setPriseEnCharges(data.filter((pc) => pc.modePaiement === "Remboursement" && !pc.remboursementId))),
      ]);
      setRemboursements(remb);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchantRemb(false);
    }
  };

  useEffect(() => {
    refreshRemboursements();
    getAssuresSante().then(setAssures);
    getActesMedicaux().then(setActes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Assurés principaux seuls (2026-08) — seule une "tête de famille" peut
  // être le bénéficiaire d'un remboursement à titre personnel (voir demande
  // utilisateur : "à l'ordre de l'assuré... ou de son souscripteur"), les
  // ayants droit consommant les soins restent sélectionnables LIGNE PAR
  // LIGNE dans RemboursementSaisie.tsx (même recherche que FactureSaisie).
  const assuresPrincipaux = useMemo(() => assures.filter((a) => a.typeAssure === "AS"), [assures]);
  const contratsDuClientRemb = useMemo(
    () => (rembHeaderForm.client ? contrats.filter((c) => c.clientId === rembHeaderForm.client!.id) : []),
    [contrats, rembHeaderForm.client],
  );
  const contratsDuFiltreRembClient = useMemo(
    () => (filtreRembClientId ? contrats.filter((c) => c.clientId === filtreRembClientId) : contrats),
    [contrats, filtreRembClientId],
  );

  const openCreateRembHeader = () => {
    setRembHeaderForm(emptyRembHeaderForm());
    setShowCreateRembHeader(true);
  };

  const handleCreateRembHeader = async () => {
    if (rembHeaderForm.beneficiaire === "AssurePrincipal" && !rembHeaderForm.assurePrincipal) {
      toast.error("L'assuré principal bénéficiaire est obligatoire.");
      return;
    }
    if (rembHeaderForm.beneficiaire === "Souscripteur" && (!rembHeaderForm.client || !rembHeaderForm.contratId)) {
      toast.error("Souscripteur et contrat sont obligatoires.");
      return;
    }
    try {
      setRembHeaderSubmitting(true);
      const payload: RemboursementUpsertInput = {
        beneficiaire: rembHeaderForm.beneficiaire,
        assurePrincipalId: rembHeaderForm.beneficiaire === "AssurePrincipal" ? rembHeaderForm.assurePrincipal!.id : undefined,
        contratId: rembHeaderForm.beneficiaire === "AssurePrincipal" ? rembHeaderForm.assurePrincipal!.contratId : rembHeaderForm.contratId,
        dateDeclaration: rembHeaderForm.dateDeclaration,
      };
      const remb = await createRemboursement(payload);
      setShowCreateRembHeader(false);
      refreshRemboursements();
      setRemboursementOuvert(remb.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création de la déclaration impossible.");
    } finally {
      setRembHeaderSubmitting(false);
    }
  };

  // Accès rapide depuis le Tableau de Bord ("Déclarer une prise en
  // charge") et depuis le bandeau (raccourcis, voir AdminShell.tsx) —
  // bascule sur le bon onglet et ouvre directement le formulaire de
  // saisie, sans que l'utilisateur ait à cliquer deux fois (voir demande
  // utilisateur).
  useEffect(() => {
    if (shellActionRequest?.view !== "prisesEnCharge") return;
    if (shellActionRequest.label === "Nouvelle prise en charge") {
      setOnglet("Remboursement");
      openCreateRembHeader();
    } else if (shellActionRequest.label === "Nouvelle facture") {
      setOnglet("TiersPayant");
      openCreateFacture();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellActionRequest]);

  const openEditRemb = (pc: PriseEnCharge) => {
    setEditingId(pc.id);
    setRembForm({ assureId: pc.assureId, prestataire: pc.prestataire, type: pc.type, montant: pc.montant, date: pc.date, modePaiement: "Remboursement" });
    setRembFormError(null);
    setShowCreateRemb(true);
  };

  const handleSelectActeRemb = (acteId: string) => {
    const acte = actes.find((a) => a.id === acteId);
    if (!acte) return;
    setRembForm((v) => ({ ...v, montant: acte.prixDefaut, type: (acte.categorieGarantie && TYPE_PAR_CATEGORIE[acte.categorieGarantie]) || v.type }));
  };

  const handleSubmitRemb = async () => {
    if (!rembForm.assureId || !rembForm.prestataire || !rembForm.type) {
      setRembFormError("Assuré, prestataire et type de soin sont obligatoires.");
      return;
    }
    try {
      setRembSubmitting(true);
      if (editingId) {
        await updatePriseEnCharge(editingId, rembForm);
        toast.success("Modifications enregistrées.");
      } else {
        await createPriseEnCharge(rembForm);
        toast.success("Remboursement déclaré avec succès.");
      }
      setShowCreateRemb(false);
      refreshRemboursements();
    } catch (err) {
      setRembFormError(err instanceof Error ? err.message : "Erreur de saisie.");
    } finally {
      setRembSubmitting(false);
    }
  };

  const famillesActes = useMemo(() => [...new Set(actes.map((a) => a.famille))].sort(), [actes]);

  return (
    <div className="p-6">
      <ModuleHeader title="Factures" subtitle="Facturation des prestations médicales et paramédicales — tiers payant et remboursements des assurés" icon={ClipboardCheck}
        actions={onglet === "TiersPayant"
          ? <Btn variant="primary" onClick={openCreateFacture}><Plus className="w-4 h-4" />Nouvelle facture</Btn>
          : <Btn variant="primary" onClick={openCreateRembHeader}><Plus className="w-4 h-4" />Déclarer un remboursement</Btn>}
      />

      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 w-fit mb-4">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" onClick={() => setOnglet(o.id)}
            className={`px-4 py-1.5 text-[13px] rounded-md transition-colors ${onglet === o.id ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label} ({o.id === "TiersPayant" ? factures.length : remboursements.length + priseEnCharges.length})
          </button>
        ))}
      </div>

      {onglet === "TiersPayant" ? (
        <>
          <div className="bg-card border border-border rounded-xl mb-4">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Rechercher des factures</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                <label className="block">
                  <div className={labelCls}>Prestataire</div>
                  <Combobox
                    options={prestataires}
                    value={prestataires.find((p) => p.id === filtrePrestataireId) ?? null}
                    onChange={(p) => setFiltrePrestataireId(p?.id ?? "")}
                    getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Souscripteur</div>
                  <Combobox
                    options={clients}
                    value={clients.find((c) => c.id === filtreClientId) ?? null}
                    onChange={(c) => { setFiltreClientId(c?.id ?? ""); setFiltreContratId(""); }}
                    getLabel={(c) => c.nom} getId={(c) => c.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Contrat</div>
                  <Combobox
                    options={contratsDuFiltreClient}
                    value={contratsDuFiltreClient.find((c) => c.id === filtreContratId) ?? null}
                    onChange={(c) => setFiltreContratId(c?.id ?? "")}
                    getLabel={(c) => numeroPolice(c)} getSubLabel={(c) => c.client} getId={(c) => c.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Statut</div>
                  <Combobox
                    options={STATUTS_FACTURE}
                    value={STATUTS_FACTURE.find((s) => s.id === filtreStatut) ?? null}
                    onChange={(s) => setFiltreStatut(s?.id ?? "")}
                    getLabel={(s) => s.libelle} getId={(s) => s.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Réception du</div>
                  <DateInput value={filtreDu} onChange={setFiltreDu} className={fieldCls} />
                </label>
                <label className="block">
                  <div className={labelCls}>Réception au</div>
                  <DateInput value={filtreAu} onChange={setFiltreAu} className={fieldCls} />
                </label>
                <label className="block">
                  <div className={labelCls}>Référence ou n° facture</div>
                  <input value={filtreReference} onChange={(e) => setFiltreReference(e.target.value)} placeholder="ex. FAC-2026-000123" className={fieldCls} />
                </label>
              </div>
              <Btn variant="primary" onClick={refreshFactures} disabled={recherchant}>
                <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
              </Btn>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Référence", "Prestataire", "Souscripteur", "Réception", "Lignes", "Montant à payer", "Statut", "Règlement", "Règlement comptable", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setFactureOuverte(f.id)}>
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{f.referenceFacture}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{f.prestataireNom}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{f.clientNom}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{f.dateReception}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">{f.lignes.length}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalFacture(f))} FCFA</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={f.statut === "Annulée" ? "danger" : f.statut === "Soumise" ? "success" : "warning"}>{f.statut}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {f.bordereauNumero ? (
                      <span title="Cette facture est déjà réglée — verrouillée pour tout nouveau règlement">
                        <Badge variant="info">N° {f.bordereauNumero}</Badge>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {f.numeroCheque ? (
                      <span title={`Lettre chèque ${f.lettreChequeNumero}`}>
                        <Badge variant="success">Chèque N° {f.numeroCheque} — {f.banqueNom}</Badge>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-primary text-xs inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Ouvrir</td>
                </tr>
              ))}
            </tbody>
          </table>
          {factures.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">Aucune facture — cliquez sur "Nouvelle facture" pour commencer.</p>}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Rechercher des remboursements</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <label className="block">
                  <div className={labelCls}>Souscripteur</div>
                  <Combobox
                    options={clients}
                    value={clients.find((c) => c.id === filtreRembClientId) ?? null}
                    onChange={(c) => { setFiltreRembClientId(c?.id ?? ""); setFiltreRembContratId(""); }}
                    getLabel={(c) => c.nom} getId={(c) => c.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Contrat</div>
                  <Combobox
                    options={contratsDuFiltreRembClient}
                    value={contratsDuFiltreRembClient.find((c) => c.id === filtreRembContratId) ?? null}
                    onChange={(c) => setFiltreRembContratId(c?.id ?? "")}
                    getLabel={(c) => numeroPolice(c)} getSubLabel={(c) => c.client} getId={(c) => c.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Assuré principal</div>
                  <Combobox
                    options={assuresPrincipaux}
                    value={assuresPrincipaux.find((a) => a.id === filtreRembAssurePrincipalId) ?? null}
                    onChange={(a) => setFiltreRembAssurePrincipalId(a?.id ?? "")}
                    getLabel={(a) => `${a.nom} ${a.prenom ?? ""}`} getSubLabel={(a) => a.matricule} getId={(a) => a.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Statut</div>
                  <Combobox
                    options={STATUTS_FACTURE}
                    value={STATUTS_FACTURE.find((s) => s.id === filtreRembStatut) ?? null}
                    onChange={(s) => setFiltreRembStatut(s?.id ?? "")}
                    getLabel={(s) => s.libelle} getId={(s) => s.id}
                    allowClear clearLabel="Tous"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Déclaration du</div>
                  <DateInput value={filtreRembDu} onChange={setFiltreRembDu} className={fieldCls} />
                </label>
                <label className="block">
                  <div className={labelCls}>Déclaration au</div>
                  <DateInput value={filtreRembAu} onChange={setFiltreRembAu} className={fieldCls} />
                </label>
              </div>
              <Btn variant="primary" onClick={refreshRemboursements} disabled={recherchantRemb}>
                <Search className="w-4 h-4" />{recherchantRemb ? "Recherche…" : "Rechercher"}
              </Btn>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Déclarations de remboursement ({remboursements.length})</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">Cas où l'assuré a avancé les frais (structure non conventionnée, ou tiers payant indisponible) — le remboursement est émis à l'ordre de l'assuré principal, ou de son souscripteur (employeur) selon les clauses contractuelles.</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Référence", "Bénéficiaire", "Souscripteur", "Date", "Lignes", "Total à rembourser", "Statut", "Règlement", ""].map((h) => (
                    <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remboursements.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setRemboursementOuvert(r.id)}>
                    <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{r.id}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {r.beneficiaire === "AssurePrincipal" ? <Users className="w-3.5 h-3.5 text-muted-foreground" /> : <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
                        {r.beneficiaire === "AssurePrincipal" ? (r.assurePrincipalNom ?? "—") : r.clientNom}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{r.clientNom}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.dateDeclaration}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{r.lignes.length}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {fmtM(r.lignes.filter((l) => l.statut !== "Rejeté").reduce((s, l) => s + (l.baseRemboursement ?? 0), 0))} FCFA
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge variant={r.statut === "Annulée" ? "danger" : r.statut === "Soumise" ? "success" : "warning"}>{r.statut}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.bordereauNumero ? (
                        <span title="Cette déclaration est déjà réglée — verrouillée pour tout nouveau règlement">
                          <Badge variant="info">N° {r.bordereauNumero}</Badge>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary text-xs inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Ouvrir</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {remboursements.length === 0 && <p className="text-xs text-center text-muted-foreground py-10">Aucune déclaration — cliquez sur "Déclarer un remboursement" pour commencer.</p>}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Demandes reçues du portail assuré ({priseEnCharges.length})</h3></div>
            <p className="text-[12px] text-muted-foreground px-4 pt-3">Justificatifs déposés en libre-service par l'assuré — à compléter (montant, type de soin, prestataire) puis à traiter ci-dessus dans une déclaration.</p>
            <div className="p-4 space-y-3">
              {priseEnCharges.map((pc) => (
                <div key={pc.id} className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{pc.id}</span>
                        <Badge variant={pc.type === "Hospitalisation" ? "danger" : "neutral"}>{pc.type}</Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                      <p className="text-xs text-muted-foreground">{pc.prestataire}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {/* Montant à rembourser = la part que l'assurance était censée
                          couvrir (baseRemboursement), jamais les frais réels présentés
                          par l'assuré — voir demande utilisateur. Pas encore calculable
                          tant que le gestionnaire n'a pas complété prestataire/type/
                          montant (valeurs de repli à la soumission portail). */}
                      {pc.baseRemboursement !== undefined ? (
                        <>
                          <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(pc.baseRemboursement)}</p>
                          {pc.montant !== pc.baseRemboursement && <p className="text-[10px] text-muted-foreground">Frais réels : {fmtM(pc.montant)}</p>}
                        </>
                      ) : (
                        <p className="text-sm font-bold text-muted-foreground">À compléter</p>
                      )}
                      <div className="mt-1"><Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge></div>
                      <button type="button" onClick={() => openEditRemb(pc)} className="mt-1.5 text-[11px] text-primary hover:underline inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Modifier</button>
                    </div>
                  </div>
                  {pc.statutControleMedical && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Contrôle médical:</span>
                        <Badge variant={controleMedicalVariant[pc.statutControleMedical] ?? "neutral"}>{pc.statutControleMedical}</Badge>
                      </div>
                      {pc.resteACharge !== undefined && (
                        <span className="text-muted-foreground">Reste à charge (non remboursé) : <span className="text-foreground font-semibold">{fmtM(pc.resteACharge)}</span></span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {priseEnCharges.length === 0 && <p className="text-xs text-center text-muted-foreground py-8">Aucune demande en attente</p>}
            </div>
          </div>
        </div>
      )}

      {showCreateFacture && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle facture</h3>
              <button type="button" onClick={() => setShowCreateFacture(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className={labelCls}>Prestataire</div>
                <Combobox
                  options={prestataires} value={factureForm.prestataire}
                  onChange={(p) => setFactureForm((v) => ({ ...v, prestataire: p }))}
                  getLabel={(p) => p.nom} getSubLabel={(p) => `${p.type} · ${p.ville}`} getId={(p) => p.id}
                  placeholder="Rechercher un prestataire…"
                />
              </div>
              <div>
                <div className={labelCls}>Souscripteur</div>
                <Combobox
                  options={clients} value={factureForm.client}
                  onChange={(c) => setFactureForm((v) => ({ ...v, client: c, contratId: "" }))}
                  getLabel={(c) => c.nom} getSubLabel={(c) => c.type} getId={(c) => c.id}
                  placeholder="Rechercher un souscripteur…"
                />
              </div>
              <div>
                <div className={labelCls}>Contrat</div>
                <select
                  value={factureForm.contratId} disabled={!factureForm.client}
                  onChange={(e) => setFactureForm((v) => ({ ...v, contratId: e.target.value }))}
                  className={`${fieldCls} disabled:opacity-60`}
                >
                  <option value="">{factureForm.client ? "— Sélectionner —" : "Choisir un souscripteur d'abord"}</option>
                  {contratsDuClient.map((c) => <option key={c.id} value={c.id}>{numeroPolice(c)} · {c.branche} · {c.compagnie}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={labelCls}>Date de réception</div>
                  <DateInput value={factureForm.dateReception} onChange={(v) => setFactureForm((f) => ({ ...f, dateReception: v }))} className={fieldCls} />
                </div>
                <div>
                  <div className={labelCls}>Référence de la facture</div>
                  <input value={factureForm.referenceFacture} onChange={(e) => setFactureForm((v) => ({ ...v, referenceFacture: e.target.value }))} className={fieldCls} placeholder="ex. FACT-2026-00123" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCreateFacture(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={factureSubmitting} onClick={handleCreateFacture} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer la facture</button>
            </div>
          </div>
        </div>
      )}

      {factureOuverte && (
        <FactureSaisie factureId={factureOuverte} onClose={() => setFactureOuverte(null)} onChanged={refreshFactures} />
      )}

      {showCreateRembHeader && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Déclarer un remboursement</h3>
              <button type="button" onClick={() => setShowCreateRembHeader(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className={labelCls}>Remboursement à l'ordre de</div>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 w-fit">
                  {([
                    { v: "AssurePrincipal" as const, label: "L'assuré principal", icon: Users },
                    { v: "Souscripteur" as const, label: "Le souscripteur", icon: Building2 },
                  ]).map(({ v, label, icon: Icon }) => (
                    <button key={v} type="button"
                      onClick={() => setRembHeaderForm((f) => ({ ...emptyRembHeaderForm(), beneficiaire: v, dateDeclaration: f.dateDeclaration }))}
                      className={`px-3 py-1.5 text-[12.5px] rounded-md inline-flex items-center gap-1.5 transition-colors ${rembHeaderForm.beneficiaire === v ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {rembHeaderForm.beneficiaire === "AssurePrincipal" ? (
                <div>
                  <div className={labelCls}>Assuré principal bénéficiaire</div>
                  <Combobox
                    options={assuresPrincipaux} value={rembHeaderForm.assurePrincipal}
                    onChange={(a) => setRembHeaderForm((v) => ({ ...v, assurePrincipal: a }))}
                    getLabel={(a) => `${a.nom} ${a.prenom ?? ""}`.trim()} getSubLabel={(a) => a.matricule} getId={(a) => a.id}
                    placeholder="Rechercher un assuré principal…"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Les membres de sa famille (conjoint, enfants) pourront chacun être sélectionnés ligne par ligne dans la déclaration, quel que soit celui qui a consommé le soin.</p>
                </div>
              ) : (
                <>
                  <div>
                    <div className={labelCls}>Souscripteur</div>
                    <Combobox
                      options={clients} value={rembHeaderForm.client}
                      onChange={(c) => setRembHeaderForm((v) => ({ ...v, client: c, contratId: "" }))}
                      getLabel={(c) => c.nom} getSubLabel={(c) => c.type} getId={(c) => c.id}
                      placeholder="Rechercher un souscripteur…"
                    />
                  </div>
                  <div>
                    <div className={labelCls}>Contrat</div>
                    <select
                      value={rembHeaderForm.contratId} disabled={!rembHeaderForm.client}
                      onChange={(e) => setRembHeaderForm((v) => ({ ...v, contratId: e.target.value }))}
                      className={`${fieldCls} disabled:opacity-60`}
                    >
                      <option value="">{rembHeaderForm.client ? "— Sélectionner —" : "Choisir un souscripteur d'abord"}</option>
                      {contratsDuClientRemb.map((c) => <option key={c.id} value={c.id}>{numeroPolice(c)} · {c.branche} · {c.compagnie}</option>)}
                    </select>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-2">Les employés couverts par ce contrat (et leurs ayants droit) pourront chacun être sélectionnés ligne par ligne dans la déclaration.</p>
                </>
              )}

              <div>
                <div className={labelCls}>Date de déclaration</div>
                <DateInput value={rembHeaderForm.dateDeclaration} onChange={(v) => setRembHeaderForm((f) => ({ ...f, dateDeclaration: v }))} className={fieldCls} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCreateRembHeader(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={rembHeaderSubmitting} onClick={handleCreateRembHeader} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Créer la déclaration</button>
            </div>
          </div>
        </div>
      )}

      {remboursementOuvert && (
        <RemboursementSaisie remboursementId={remboursementOuvert} onClose={() => setRemboursementOuvert(null)} onChanged={refreshRemboursements} />
      )}

      {showCreateRemb && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editingId ? "Modifier" : "Déclarer un remboursement"}</h3>
              <button type="button" onClick={() => setShowCreateRemb(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <div className={labelCls}>Assuré</div>
                <select value={rembForm.assureId} onChange={(e) => setRembForm((v) => ({ ...v, assureId: e.target.value }))} className={fieldCls}>
                  <option value="">— Sélectionner —</option>
                  {assures.map((a) => <option key={a.id} value={a.id}>{a.nom} · {a.matricule}</option>)}
                </select>
              </label>
              <label className="block"><div className={labelCls}>Prestataire</div><input value={rembForm.prestataire} onChange={(e) => setRembForm((v) => ({ ...v, prestataire: e.target.value }))} className={fieldCls} /></label>
              <label className="block md:col-span-2">
                <div className={labelCls}>Acte médical (catalogue) — pré-remplit le montant et le type de soin</div>
                <select defaultValue="" onChange={(e) => e.target.value && handleSelectActeRemb(e.target.value)} className={fieldCls}>
                  <option value="">— Choisir un acte dans le catalogue —</option>
                  {famillesActes.map((famille) => (
                    <optgroup key={famille} label={famille}>
                      {actes.filter((a) => a.famille === famille).map((a) => (
                        <option key={a.id} value={a.id}>{a.libelle} — {a.prixDefaut.toLocaleString("fr-FR")} FCFA</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block"><div className={labelCls}>Type de soin</div><select value={rembForm.type} onChange={(e) => setRembForm((v) => ({ ...v, type: e.target.value }))} className={fieldCls}><option>Consultation</option><option>Hospitalisation</option><option>Pharmacie</option><option>Analyses</option><option>Dentaire</option></select></label>
              <label className="block"><div className={labelCls}>Montant (FCFA)</div><input type="number" value={rembForm.montant} onChange={(e) => setRembForm((v) => ({ ...v, montant: Number(e.target.value) }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Date</div><DateInput value={rembForm.date} onChange={(v) => setRembForm((f) => ({ ...f, date: v }))} className={fieldCls} /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{rembFormError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreateRemb(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={rembSubmitting} onClick={handleSubmitRemb} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">{editingId ? "Enregistrer les modifications" : "Déclarer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

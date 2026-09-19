import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Download, Upload, Plus, Eye, Edit, User, Phone, Mail, MapPin, FileText, TrendingUp,
  Building2, Briefcase, IdCard, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { DateInput } from "@/components/shared/DateInput";
import { ImportEnMasseModal } from "@/components/shared/ImportEnMasseModal";
import { fmt } from "@/lib/format";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  createClient,
  deleteClient,
  getClientPortfolio,
  getClients,
  updateClient,
  uploadClientLogo,
  deleteClientLogo,
  telechargerModeleImportClients, apercuImportClients, confirmerImportClients,
  type ImportClientRow,
  clientLogoUrl,
  type ClientUpsertInput,
} from "@/services/clients.service";
import type { Client, ClientPortfolio } from "@/types/clients";

export function ClientLogo({ logo, nom, taille = 48 }: { logo?: string | null; nom: string; taille?: number }) {
  const url = clientLogoUrl(logo);
  return url
    ? <img src={url} alt="" className="rounded-xl object-contain bg-white flex-shrink-0 border border-border" style={{ width: taille, height: taille }} />
    : (
      <div className="rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0" style={{ width: taille, height: taille }} title={nom}>
        <Building2 className="text-primary" style={{ width: taille * 0.5, height: taille * 0.5 }} />
      </div>
    );
}

const categoriesMorale = ["Société privée", "Société publique", "Parapublique", "Administration publique", "Ministère", "Organisme", "Association", "Autre"] as const;
const sexes = ["M", "F"] as const;
const situationsMatrimoniales = ["Célibataire", "Marié", "Mariée", "Divorcé", "Divorcée", "Veuf", "Veuve"] as const;
const piecesIdentite = ["CNI", "Passeport", "Permis de conduire", "Carte consulaire"] as const;

const defaultClientForm: ClientUpsertInput = {
  nom: "",
  type: "Entreprise",
  pays: "Gabon",
  contact: "",
  tel: "",
  email: "",
  statut: "Actif",
  ville: "",
  adresse: "",
  boitePostale: "",
  telSecondaire: "",
  categorieMorale: undefined,
  formeJuridique: "",
  rccm: "",
  nif: "",
  secteurActivite: "",
  effectif: undefined,
  representantNom: "",
  representantFonction: "",
  representantTel: "",
  representantEmail: "",
  prenom: "",
  dateNaissance: "",
  lieuNaissance: "",
  sexe: undefined,
  nationalite: "Gabonaise",
  situationMatrimoniale: undefined,
  profession: "",
  employeur: "",
  pieceIdentiteType: undefined,
  pieceIdentiteNumero: "",
};

function clientToForm(c: Client): ClientUpsertInput {
  return {
    nom: c.nom, type: c.type, pays: c.pays, contact: c.contact, tel: c.tel, email: c.email, statut: c.statut,
    ville: c.ville ?? "", adresse: c.adresse ?? "", boitePostale: c.boitePostale ?? "", telSecondaire: c.telSecondaire ?? "",
    categorieMorale: c.categorieMorale, formeJuridique: c.formeJuridique ?? "", rccm: c.rccm ?? "", nif: c.nif ?? "",
    secteurActivite: c.secteurActivite ?? "", effectif: c.effectif,
    representantNom: c.representantNom ?? "", representantFonction: c.representantFonction ?? "", representantTel: c.representantTel ?? "", representantEmail: c.representantEmail ?? "",
    prenom: c.prenom ?? "", dateNaissance: c.dateNaissance ?? "", lieuNaissance: c.lieuNaissance ?? "", sexe: c.sexe,
    nationalite: c.nationalite ?? "Gabonaise", situationMatrimoniale: c.situationMatrimoniale, profession: c.profession ?? "", employeur: c.employeur ?? "",
    pieceIdentiteType: c.pieceIdentiteType, pieceIdentiteNumero: c.pieceIdentiteNumero ?? "",
  };
}

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function ClientsView() {
  const { setView, shellActionRequest, scrollToTop } = useShellNavigation();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Tous" | "Entreprise" | "Particulier">("Tous");
  // Recherche avancée (2026-09 — voir demande utilisateur : "ajouter des
  // filtres de recherche avancée dans l'onglet souscripteur... prenant en
  // compte plusieurs facteurs de recherche et le bouton de recherche").
  const [statutFilter, setStatutFilter] = useState<"Tous" | "Actif" | "Inactif">("Tous");
  const [villeFilter, setVilleFilter] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<ClientUpsertInput>(defaultClientForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  useEffect(() => {
    refreshClients();
  }, []);

  const refreshClients = () => {
    getClients().then((data) => {
      setClients(data);
      if (selected?.id) {
        const refreshedSelected = data.find((c) => c.id === selected.id) ?? null;
        setSelected(refreshedSelected);
      }
    });
  };

  useEffect(() => {
    if (!selected?.id) {
      setPortfolio(null);
      setPortfolioError(null);
      return;
    }
    setPortfolioLoading(true);
    setPortfolioError(null);
    getClientPortfolio(selected.id)
      .then(setPortfolio)
      .catch(() => setPortfolioError("Impossible de charger le portefeuille global du souscripteur."))
      .finally(() => setPortfolioLoading(false));
  }, [selected?.id]);

  const filtered = useMemo(
    () => clients.filter((c) => {
      const q = search.toLowerCase();
      const v = villeFilter.trim().toLowerCase();
      return (
        (c.nom.toLowerCase().includes(q) || c.pays.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)) &&
        (typeFilter === "Tous" || c.type === typeFilter) &&
        (statutFilter === "Tous" || c.statut === statutFilter) &&
        (!v || (c.ville ?? "").toLowerCase().includes(v))
      );
    }),
    [clients, search, typeFilter, statutFilter, villeFilter],
  );

  const openCreate = () => {
    setForm(defaultClientForm);
    setFormError(null);
    setShowCreate(true);
  };

  // Raccourci d'accès rapide depuis le bandeau (2026-08) — voir
  // AdminShell.tsx, même principe que "Déclarer une prise en charge" sur
  // le Tableau de Bord (voir demande utilisateur).
  useEffect(() => {
    if (shellActionRequest?.view === "clients" && shellActionRequest.label === "Nouveau souscripteur") openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellActionRequest]);

  const openEdit = () => {
    if (!selected) {
      toast.error("Sélectionnez un souscripteur à modifier.");
      return;
    }
    setForm(clientToForm(selected));
    setFormError(null);
    setShowEdit(true);
  };

  const validateForm = () => {
    if (!form.nom || !form.pays || !form.contact || !form.tel || !form.email) {
      return "Nom, pays, contact, téléphone et email sont obligatoires.";
    }
    if (form.type === "Entreprise" && !form.categorieMorale) {
      return "La catégorie de personne morale est obligatoire pour un souscripteur Entreprise.";
    }
    if (form.type === "Particulier" && (!form.prenom || !form.dateNaissance)) {
      return "Prénom et date de naissance sont obligatoires pour un souscripteur Particulier.";
    }
    return null;
  };

  const handleCreate = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    try {
      setSubmitting(true);
      await createClient(form);
      setShowCreate(false);
      setForm(defaultClientForm);
      refreshClients();
      toast.success("Souscripteur créé avec succès.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de création du souscripteur.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    try {
      setSubmitting(true);
      await updateClient(selected.id, form);
      setShowEdit(false);
      refreshClients();
      toast.success("Souscripteur mis à jour.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de mise à jour.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!selected) return;
    setUploadingLogo(true);
    try {
      await uploadClientLogo(selected.id, file);
      refreshClients();
      toast.success("Logo importé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import du logo impossible.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!selected) return;
    try {
      await deleteClientLogo(selected.id);
      refreshClients();
      toast.success("Logo retiré.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression du logo impossible.");
    }
  };

  const handleDelete = async () => {
    if (!selected) {
      toast.error("Sélectionnez un souscripteur à supprimer.");
      return;
    }
    const ok = window.confirm(`Supprimer le souscripteur ${selected.nom} ?`);
    if (!ok) return;
    try {
      await deleteClient(selected.id);
      setSelected(null);
      refreshClients();
      toast.success("Souscripteur supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const exportFilteredClients = () => {
    if (!filtered.length) {
      toast.error("Aucune ligne à exporter.");
      return;
    }
    const header = ["ID", "Nom", "Type", "Pays", "Contact", "Téléphone", "Email", "Statut", "Contrats", "Prime"];
    const rows = filtered.map((c) => [c.id, c.nom, c.type, c.pays, c.contact, c.tel, c.email, c.statut, String(c.contrats), String(c.prime)]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Export clients généré.");
  };

  return (
    <div className="p-6">
      <ModuleHeader
        title="Gestion des Souscripteurs"
        subtitle={`${clients.length} souscripteurs enregistrés · ${clients.filter((c) => c.statut === "Actif").length} actifs`}
        icon={Users}
        actions={
          <>
            <Btn variant="secondary" onClick={exportFilteredClients}><Download className="w-4 h-4" />Export</Btn>
            <Btn variant="secondary" onClick={() => setShowImport(true)}><Upload className="w-4 h-4" />Import en masse</Btn>
            <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouveau souscripteur</Btn>
          </>
        }
      />
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-colors"
            placeholder="Rechercher par nom, pays, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-border rounded-xl overflow-hidden bg-card/85">
          {(["Tous", "Entreprise", "Particulier"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2.5 text-sm transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground font-semibold" : "bg-card/90 text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex border border-border rounded-xl overflow-hidden bg-card/85">
          {(["Tous", "Actif", "Inactif"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatutFilter(s)}
              className={`px-4 py-2.5 text-sm transition-colors ${statutFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card/90 text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          className="w-40 px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/10 transition-colors"
          placeholder="Ville…"
          value={villeFilter}
          onChange={(e) => setVilleFilter(e.target.value)}
        />
        {/* Bouton de recherche explicite (2026-09 — voir demande
            utilisateur : "...prenant en compte plusieurs facteurs de
            recherche et le bouton de recherche") — les filtres ci-dessus
            s'appliquent déjà en direct ; ce bouton relance en plus une
            recherche fraîche côté serveur. */}
        <Btn variant="primary" onClick={refreshClients}><Search className="w-4 h-4" />Rechercher</Btn>
        {(search || villeFilter || typeFilter !== "Tous" || statutFilter !== "Tous") && (
          <button
            type="button"
            onClick={() => { setSearch(""); setVilleFilter(""); setTypeFilter("Tous"); setStatutFilter("Tous"); }}
            className="text-[12px] text-muted-foreground hover:text-primary underline whitespace-nowrap self-center"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Souscripteur", "Pays", "Contrats", "Prime Totale", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => { setSelected(c); scrollToTop(); }}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {c.nom.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.nom}</p>
                        <p className="text-xs text-muted-foreground">{c.type === "Entreprise" ? (c.categorieMorale ?? c.type) : c.type} · {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.pays}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-foreground med-num">{c.contrats}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground med-num">{fmt(c.prime)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.statut === "Actif" ? "success" : "neutral"}>{c.statut}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucun résultat pour votre recherche</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-border">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 ${selected.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                  {selected.nom.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-foreground">{selected.nom}</h3>
                <p className="text-xs text-muted-foreground">{selected.type === "Entreprise" ? (selected.categorieMorale ?? selected.type) : selected.type} · {selected.id}</p>
                <div className="mt-2"><Badge variant={selected.statut === "Actif" ? "success" : "neutral"}>{selected.statut}</Badge></div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: User, label: "Contact", value: selected.contact },
                  { icon: Phone, label: "Téléphone", value: selected.tel },
                  { icon: Mail, label: "Email", value: selected.email },
                  { icon: MapPin, label: "Pays / Ville", value: [selected.pays, selected.ville].filter(Boolean).join(" · ") },
                  ...(selected.type === "Entreprise"
                    ? [
                        ...(selected.formeJuridique ? [{ icon: Building2, label: "Forme juridique", value: selected.formeJuridique }] : []),
                        ...(selected.rccm ? [{ icon: IdCard, label: "RCCM", value: selected.rccm }] : []),
                        ...(selected.effectif ? [{ icon: Briefcase, label: "Effectif", value: `${selected.effectif} employés` }] : []),
                      ]
                    : [
                        ...(selected.dateNaissance ? [{ icon: Calendar, label: "Date de naissance", value: selected.dateNaissance }] : []),
                        ...(selected.profession ? [{ icon: Briefcase, label: "Profession", value: selected.profession }] : []),
                        ...(selected.pieceIdentiteNumero ? [{ icon: IdCard, label: selected.pieceIdentiteType ?? "Pièce d'identité", value: selected.pieceIdentiteNumero }] : []),
                      ]),
                  { icon: FileText, label: "Contrats", value: `${selected.contrats} polices actives` },
                  { icon: TrendingUp, label: "Prime totale", value: fmt(selected.prime) },
                ].map(({ icon: I, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <I className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm text-foreground font-medium break-all">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Btn
                  variant="primary"
                  className="flex-1 justify-center"
                  onClick={() => {
                    setView("contrats");
                    toast.success("Navigation vers le module Contrats.");
                  }}
                >
                  <Eye className="w-4 h-4" />Portefeuille
                </Btn>
                <Btn variant="secondary" className="flex-1 justify-center" onClick={openEdit}><Edit className="w-4 h-4" />Éditer</Btn>
              </div>
              <Btn variant="ghost" className="w-full justify-center" onClick={handleDelete}>Supprimer le souscripteur</Btn>
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-semibold text-foreground mb-2">Contrats globaux (Maladie + Assistance)</p>
                {portfolioLoading && <p className="text-xs text-muted-foreground">Chargement du portefeuille…</p>}
                {portfolioError && <p className="text-xs text-destructive">{portfolioError}</p>}
                {!portfolioLoading && !portfolioError && (portfolio?.contrats.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun contrat rattaché à ce souscripteur.</p>
                )}
                {!portfolioLoading && !portfolioError && (portfolio?.contrats.length ?? 0) > 0 && (
                  <div className="space-y-2 max-h-48 overflow-auto pr-1">
                    {portfolio!.contrats.map((c) => (
                      <div key={`${c.source}-${c.reference}`} className="rounded-lg border border-border px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{c.reference}</p>
                          <Badge variant={c.produit === "Assistance" ? "info" : "neutral"}>{c.produit}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{c.compagnie}</p>
                        <p className="text-xs text-foreground mt-1 med-num">{fmt(c.prime)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center med-empty-state animate-fade-slide">
              <div className="med-empty-icon p-3 mb-3">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Sélectionnez un souscripteur<br />pour voir le détail</p>
            </div>
          )}
        </div>
      </div>

      {(showCreate || showEdit) && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h3 className="text-[15px] font-semibold text-foreground">{showCreate ? "Créer un souscripteur" : "Modifier un souscripteur"}</h3>
              <button type="button" onClick={() => { setShowCreate(false); setShowEdit(false); setFormError(null); }} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>

            <div className="p-5 space-y-6">
              {/* Logo — uploadé après création (nécessite un identifiant), voir CompagnieParamsDrawer pour le même pattern */}
              {showEdit && selected && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Logo</div>
                  <div className="flex items-center gap-3">
                    <ClientLogo logo={selected.logo} nom={selected.nom} taille={56} />
                    <label className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center cursor-pointer">
                      {uploadingLogo ? "Import…" : "Importer un logo"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); e.target.value = ""; }} />
                    </label>
                    {selected.logo && (
                      <button type="button" onClick={handleDeleteLogo} className="h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:bg-secondary/40">Retirer</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Sans logo, le nom du souscripteur fait office d'identité visuelle sur les documents.</p>
                </div>
              )}

              {/* Type de souscripteur */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Type de souscripteur</div>
                <div className="flex border border-border rounded-xl overflow-hidden w-fit">
                  {(["Entreprise", "Particulier"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((v) => ({ ...v, type: t }))}
                      className={`px-4 py-2 text-sm transition-colors ${form.type === t ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    >
                      {t === "Entreprise" ? "Personne morale (Entreprise)" : "Personne physique (Particulier)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Identité & coordonnées communes */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Identité & coordonnées</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <div className={labelCls}>{form.type === "Entreprise" ? "Raison sociale" : "Nom complet"}</div>
                    <input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} />
                  </label>
                  {form.type === "Particulier" && (
                    <label className="block"><div className={labelCls}>Prénom</div><input value={form.prenom ?? ""} onChange={(e) => setForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
                  )}
                  <label className="block"><div className={labelCls}>Pays</div><input value={form.pays} onChange={(e) => setForm((v) => ({ ...v, pays: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Ville</div><input value={form.ville ?? ""} onChange={(e) => setForm((v) => ({ ...v, ville: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Adresse</div><input value={form.adresse ?? ""} onChange={(e) => setForm((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Boîte postale</div><input value={form.boitePostale ?? ""} onChange={(e) => setForm((v) => ({ ...v, boitePostale: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Téléphone</div><input value={form.tel} onChange={(e) => setForm((v) => ({ ...v, tel: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Téléphone secondaire</div><input value={form.telSecondaire ?? ""} onChange={(e) => setForm((v) => ({ ...v, telSecondaire: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Contact principal</div><input value={form.contact} onChange={(e) => setForm((v) => ({ ...v, contact: e.target.value }))} className={fieldCls} /></label>
                  <label className="block"><div className={labelCls}>Statut</div><select value={form.statut} onChange={(e) => setForm((v) => ({ ...v, statut: e.target.value as ClientUpsertInput["statut"] }))} className={fieldCls}><option>Actif</option><option>Inactif</option></select></label>
                </div>
              </div>

              {form.type === "Entreprise" ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Informations personne morale</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <div className={labelCls}>Catégorie</div>
                      <select value={form.categorieMorale ?? ""} onChange={(e) => setForm((v) => ({ ...v, categorieMorale: e.target.value as ClientUpsertInput["categorieMorale"] }))} className={fieldCls}>
                        <option value="">— Sélectionner —</option>
                        {categoriesMorale.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block"><div className={labelCls}>Forme juridique</div><input value={form.formeJuridique ?? ""} onChange={(e) => setForm((v) => ({ ...v, formeJuridique: e.target.value }))} className={fieldCls} placeholder="SA, SARL, Établissement public…" /></label>
                    <label className="block"><div className={labelCls}>RCCM</div><input value={form.rccm ?? ""} onChange={(e) => setForm((v) => ({ ...v, rccm: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>NIF</div><input value={form.nif ?? ""} onChange={(e) => setForm((v) => ({ ...v, nif: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Secteur d'activité</div><input value={form.secteurActivite ?? ""} onChange={(e) => setForm((v) => ({ ...v, secteurActivite: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Effectif</div><input type="number" value={form.effectif ?? ""} onChange={(e) => setForm((v) => ({ ...v, effectif: e.target.value ? Number(e.target.value) : undefined }))} className={fieldCls} /></label>
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground mt-4 mb-2">Représentant légal</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block"><div className={labelCls}>Nom</div><input value={form.representantNom ?? ""} onChange={(e) => setForm((v) => ({ ...v, representantNom: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Fonction</div><input value={form.representantFonction ?? ""} onChange={(e) => setForm((v) => ({ ...v, representantFonction: e.target.value }))} className={fieldCls} placeholder="Directeur Général, DRH…" /></label>
                    <label className="block"><div className={labelCls}>Téléphone</div><input value={form.representantTel ?? ""} onChange={(e) => setForm((v) => ({ ...v, representantTel: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.representantEmail ?? ""} onChange={(e) => setForm((v) => ({ ...v, representantEmail: e.target.value }))} className={fieldCls} /></label>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Informations personne physique</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block"><div className={labelCls}>Date de naissance</div><DateInput value={form.dateNaissance ?? ""} onChange={(v) => setForm((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Lieu de naissance</div><input value={form.lieuNaissance ?? ""} onChange={(e) => setForm((v) => ({ ...v, lieuNaissance: e.target.value }))} className={fieldCls} /></label>
                    <label className="block">
                      <div className={labelCls}>Sexe</div>
                      <select value={form.sexe ?? ""} onChange={(e) => setForm((v) => ({ ...v, sexe: e.target.value as ClientUpsertInput["sexe"] }))} className={fieldCls}>
                        <option value="">—</option>
                        {sexes.map((s) => <option key={s} value={s}>{s === "M" ? "Masculin" : "Féminin"}</option>)}
                      </select>
                    </label>
                    <label className="block"><div className={labelCls}>Nationalité</div><input value={form.nationalite ?? ""} onChange={(e) => setForm((v) => ({ ...v, nationalite: e.target.value }))} className={fieldCls} /></label>
                    <label className="block">
                      <div className={labelCls}>Situation matrimoniale</div>
                      <select value={form.situationMatrimoniale ?? ""} onChange={(e) => setForm((v) => ({ ...v, situationMatrimoniale: e.target.value as ClientUpsertInput["situationMatrimoniale"] }))} className={fieldCls}>
                        <option value="">—</option>
                        {situationsMatrimoniales.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="block"><div className={labelCls}>Profession</div><input value={form.profession ?? ""} onChange={(e) => setForm((v) => ({ ...v, profession: e.target.value }))} className={fieldCls} /></label>
                    <label className="block"><div className={labelCls}>Employeur</div><input value={form.employeur ?? ""} onChange={(e) => setForm((v) => ({ ...v, employeur: e.target.value }))} className={fieldCls} /></label>
                    <label className="block">
                      <div className={labelCls}>Type de pièce d'identité</div>
                      <select value={form.pieceIdentiteType ?? ""} onChange={(e) => setForm((v) => ({ ...v, pieceIdentiteType: e.target.value as ClientUpsertInput["pieceIdentiteType"] }))} className={fieldCls}>
                        <option value="">—</option>
                        {piecesIdentite.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </label>
                    <label className="block"><div className={labelCls}>N° pièce d'identité</div><input value={form.pieceIdentiteNumero ?? ""} onChange={(e) => setForm((v) => ({ ...v, pieceIdentiteNumero: e.target.value }))} className={fieldCls} /></label>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex items-center justify-between sticky bottom-0 bg-card">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setShowCreate(false); setShowEdit(false); setFormError(null); }} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={showCreate ? handleCreate : handleEdit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">{showCreate ? "Créer" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportEnMasseModal<ImportClientRow>
          titre="Import en masse de souscripteurs"
          onClose={() => setShowImport(false)}
          onImported={refreshClients}
          telechargerModele={telechargerModeleImportClients}
          apercu={apercuImportClients}
          confirmer={confirmerImportClients}
          colonnes={[
            { key: "nom", label: "Nom" },
            { key: "type", label: "Type" },
            { key: "contact", label: "Contact" },
            { key: "tel", label: "Téléphone" },
            { key: "email", label: "Email" },
            { key: "ville", label: "Ville" },
          ]}
        />
      )}
    </div>
  );
}

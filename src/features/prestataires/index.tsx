import { useEffect, useMemo, useState } from "react";
import { Building2, Star, Clock, ShieldOff, ShieldCheck, Stethoscope, Plus, Pencil, ReceiptText, Printer, ClipboardList, FileStack, TrendingUp, Search, X, MapPin, MapPinOff, Loader2, FileDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Combobox } from "@/components/shared/Combobox";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { fmtM } from "@/lib/format";
import {
  getPrestataires, suspendrePrestataire, rehabiliterPrestataire, definirSecteurPrestataire,
  getPrestataireStatistiques, geolocaliserLotPrestataires, creerComptesPortailManquants, type PrestataireStatistiques,
} from "@/services/prestataires.service";
import { openFichePrestataire, openReseauSoins } from "@/services/documents.service";
import PrestataireForm from "./PrestataireForm";
import { PortailTab } from "./PortailTab";
import type { Prestataire } from "@/types/prestataires";

const statutVariant: Record<string, "success" | "warning" | "danger"> = {
  "Conventionné": "success", "En négociation": "warning", "Suspendu": "danger",
};

export default function PrestatairesView() {
  const { scrollToTop } = useShellNavigation();
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [selected, setSelected] = useState<Prestataire | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [statistiques, setStatistiques] = useState<PrestataireStatistiques | null>(null);
  const [ongletDetail, setOngletDetail] = useState<"fiche" | "portail">("fiche");

  // Filtres de recherche (2026-08) — voir demande utilisateur : "je veux que
  // les prestataires soient classés type et par ville. Il faut des filtres
  // de recherche spécifique" (motivé par l'import des 346 prestataires du
  // réseau de soins, la liste plate n'étant plus exploitable).
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [filtreVille, setFiltreVille] = useState<string | null>(null);

  const typesDisponibles = useMemo(
    () => [...new Set(prestataires.map((p) => p.type))].sort((a, b) => a.localeCompare(b, "fr")),
    [prestataires],
  );
  const villesDisponibles = useMemo(
    () => [...new Set(prestataires.map((p) => p.ville))].sort((a, b) => a.localeCompare(b, "fr")),
    [prestataires],
  );

  const prestatairesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return prestataires.filter((p) => {
      if (filtreType && p.type !== filtreType) return false;
      if (filtreVille && p.ville !== filtreVille) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prestataires, recherche, filtreType, filtreVille]);

  // Classement ville → type → prestataires (ordre alphabétique) — reflète
  // l'organisation du réseau de soins (voir DocumentsService.renderReseauSoins).
  const groupes = useMemo(() => {
    const parVille = new Map<string, Map<string, Prestataire[]>>();
    for (const p of prestatairesFiltres) {
      if (!parVille.has(p.ville)) parVille.set(p.ville, new Map());
      const parType = parVille.get(p.ville)!;
      if (!parType.has(p.type)) parType.set(p.type, []);
      parType.get(p.type)!.push(p);
    }
    return [...parVille.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([ville, parType]) => ({
        ville,
        total: [...parType.values()].reduce((s, items) => s + items.length, 0),
        types: [...parType.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], "fr"))
          .map(([type, items]) => ({ type, items: [...items].sort((a, b) => a.nom.localeCompare(b.nom, "fr")) })),
      }));
  }, [prestatairesFiltres]);

  const filtresActifs = recherche.trim() !== "" || filtreType !== null || filtreVille !== null;
  const reinitialiserFiltres = () => { setRecherche(""); setFiltreType(null); setFiltreVille(null); };

  // Géolocalisation en masse (2026-08) — voir demande utilisateur : "grâce
  // à la liste présente, aller sur Google Maps ou n'importe quelle solution
  // récupérer les coordonnées géographiques réelles et authentiques de
  // chaque prestataire". Boucle par lots (voir PrestatairesService.
  // geolocaliserLot) jusqu'à épuisement, avec progression affichée.
  const [geoEnCours, setGeoEnCours] = useState(false);
  const [geoProgres, setGeoProgres] = useState<{ traites: number; trouves: number; villesCorrigees: number; echecs: number; total: number } | null>(null);

  const handleGeolocaliserReseau = async () => {
    if (geoEnCours) return;
    setGeoEnCours(true);
    setGeoProgres(null);
    let cumulTraites = 0;
    let cumulTrouves = 0;
    let cumulVilles = 0;
    try {
      let restants = 1;
      let restantsPrecedent = -1;
      let dernierEchecs = 0;
      let stagnation = 0;
      while (restants > 0) {
        const lot = await geolocaliserLotPrestataires(15);
        cumulTraites += lot.traites;
        cumulTrouves += lot.trouves;
        cumulVilles += lot.villesCorrigees;
        dernierEchecs = lot.echecs;
        restants = lot.restants;
        setGeoProgres({ traites: cumulTraites, trouves: cumulTrouves, villesCorrigees: cumulVilles, echecs: lot.echecs, total: lot.total });
        if (lot.traites === 0) break; // garde-fou : plus rien à traiter
        // Garde-fou anti-blocage : si Nominatim reste indisponible (erreurs
        // transitoires en boucle), `restants` cesse de baisser — on
        // n'insiste pas indéfiniment, l'utilisateur pourra relancer plus tard.
        stagnation = restants === restantsPrecedent ? stagnation + 1 : 0;
        restantsPrecedent = restants;
        if (stagnation >= 3) { toast.warning("Le service de géolocalisation semble temporairement indisponible — réessayez dans quelques minutes."); break; }
      }
      await refresh();
      toast.success(`Géolocalisation terminée — ${cumulTrouves} prestataire(s) localisé(s) sur ${cumulTraites} traité(s)${cumulVilles ? `, ${cumulVilles} ville(s) corrigée(s)` : ""}${dernierEchecs ? `, ${dernierEchecs} adresse(s) introuvable(s) au total` : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Géolocalisation impossible.");
    } finally {
      setGeoEnCours(false);
    }
  };

  // Téléchargement du réseau de soins (2026-08) — voir demande utilisateur :
  // "au niveau du Réseau on doit pouvoir télécharger le fichier du réseau
  // de soins et visionner dans la visionneuse" — même document que celui
  // joint à chaque cotation (DocumentsService.renderReseauSoins), ouvert
  // ici directement depuis l'écran qui gère les prestataires eux-mêmes.
  const handleTelechargerReseauSoins = () => openReseauSoins().catch(() => toast.error("Ouverture du document impossible."));

  const refresh = () =>
    getPrestataires().then((data) => {
      setPrestataires(data);
      setSelected((s) => (s ? data.find((p) => p.id === s.id) ?? data[0] ?? null : data[0] ?? null));
    });

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    setStatistiques(null);
    setOngletDetail("fiche");
    if (selected) getPrestataireStatistiques(selected.id).then(setStatistiques);
  }, [selected?.id]);

  const handleSuspendre = async () => {
    if (!selected) return;
    const motif = window.prompt("Motif de suspension (fraude, surtarification, non-respect des délais…) :");
    if (!motif) return;
    const updated = await suspendrePrestataire(selected.id, motif);
    setPrestataires((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
  };

  const handleRehabiliter = async () => {
    if (!selected) return;
    const updated = await rehabiliterPrestataire(selected.id);
    setPrestataires((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
  };

  const handleDefinirSecteur = async (secteur: "Public" | "Privé") => {
    if (!selected) return;
    const updated = await definirSecteurPrestataire(selected.id, secteur);
    setPrestataires((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    setSelected(updated);
  };

  const handleSaved = (p: Prestataire) => {
    setPrestataires((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));
    setSelected(p);
  };

  // "Créer les comptes portail manquants" (2026-09) — voir demande
  // utilisateur : "un bouton qui permet de lancer automatiquement la
  // création des comptes utilisateurs pour les nouveaux prestataires
  // créés" — parcourt tous les prestataires de la société et complète
  // uniquement ceux à qui il manque un compte (Accueil/Vendeur,
  // Facturation, Médecin/Pharmacien), jamais de doublon. Sans SMS en
  // masse — les identifiants restent consultables dans l'onglet Portail
  // de chaque fiche.
  const [creationEnCours, setCreationEnCours] = useState(false);
  const handleCreerComptesManquants = async () => {
    setCreationEnCours(true);
    try {
      const res = await creerComptesPortailManquants();
      if (res.comptesCrees === 0) {
        toast.success("Tous les prestataires ont déjà leurs comptes portail.");
      } else {
        toast.success(`${res.comptesCrees} compte(s) créé(s) pour ${res.prestatairesTraites} prestataire(s).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création des comptes impossible.");
    } finally {
      setCreationEnCours(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Prestataires" subtitle="Réseau de soins conventionné — hôpitaux, cliniques, pharmacies, laboratoires" icon={Stethoscope}
        actions={
          <>
            <Btn variant="secondary" onClick={handleTelechargerReseauSoins}><FileDown className="w-4 h-4" />Télécharger le réseau de soins</Btn>
            <Btn variant="secondary" onClick={handleGeolocaliserReseau} disabled={geoEnCours}>
              {geoEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {geoEnCours && geoProgres ? `${geoProgres.traites}/${geoProgres.total}…` : "Géolocaliser le réseau"}
            </Btn>
            <Btn variant="secondary" onClick={handleCreerComptesManquants} disabled={creationEnCours}>
              {creationEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Créer les comptes portail manquants
            </Btn>
            <Btn variant="primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" />Nouveau prestataire</Btn>
          </>
        }
      />
      {geoProgres && (
        <div className="mb-4 -mt-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[12px] text-foreground flex items-center gap-3">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>{geoEnCours ? "Géolocalisation en cours" : "Dernière géolocalisation"} — {geoProgres.traites} traité(s), <span className="text-green-500 font-semibold">{geoProgres.trouves} localisé(s)</span>{geoProgres.villesCorrigees > 0 && <>, <span className="text-primary font-semibold">{geoProgres.villesCorrigees} ville(s) corrigée(s)</span></>}{geoProgres.echecs > 0 && <>, <span className="text-amber-500 font-semibold">{geoProgres.echecs} introuvable(s)</span></>}.</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground text-sm">Prestataires ({prestatairesFiltres.length}{filtresActifs ? ` / ${prestataires.length}` : ""})</h3>
              {filtresActifs && (
                <button type="button" onClick={reinitialiserFiltres} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <X className="w-3 h-3" />Réinitialiser
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom, une spécialité…"
                className="w-full border border-border rounded-lg pl-8 pr-3 py-2 bg-background text-[13px] text-foreground"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Combobox
                options={typesDisponibles} value={filtreType} onChange={setFiltreType}
                getLabel={(t) => t} getId={(t) => t} placeholder="Type" allowClear clearLabel="Tous les types"
              />
              <Combobox
                options={villesDisponibles} value={filtreVille} onChange={setFiltreVille}
                getLabel={(v) => v} getId={(v) => v} placeholder="Ville" allowClear clearLabel="Toutes les villes"
              />
            </div>
          </div>
          <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
            {groupes.map((g) => (
              <div key={g.ville}>
                <div className="px-4 py-1.5 bg-secondary/60 sticky top-0 z-10 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wide">{g.ville}</p>
                  <span className="text-[10px] text-muted-foreground">{g.total}</span>
                </div>
                {g.types.map((t) => (
                  <div key={t.type}>
                    <div className="px-4 py-1 bg-secondary/20">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.type} · {t.items.length}</p>
                    </div>
                    {t.items.map((p) => (
                      <div key={p.id} onClick={() => { setSelected(p); scrollToTop(); }}
                        className={`px-4 py-3 cursor-pointer transition-colors ${selected?.id === p.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{p.nom}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {p.latitude != null && p.longitude != null
                              ? <MapPin className="w-3 h-3 text-green-500" />
                              : <MapPinOff className="w-3 h-3 text-muted-foreground/40" />}
                            <Badge variant={statutVariant[p.statutConvention] ?? "neutral"}>{p.statutConvention}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.type} · {p.ville}, {p.pays}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {prestatairesFiltres.length === 0 && (
              <p className="text-xs text-center text-muted-foreground py-10">
                {prestataires.length === 0 ? 'Aucun prestataire — cliquez sur "Nouveau prestataire" pour commencer.' : "Aucun résultat pour ces filtres."}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{selected.titre ? `${selected.titre} ` : ""}{selected.nom}</h3>
                  <p className="text-xs text-muted-foreground">{selected.type}{selected.specialite ? ` — ${selected.specialite}` : ""} · {selected.ville}, {selected.pays}</p>
                  {(selected.telephone || selected.adresse) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{[selected.telephone, selected.adresse].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statutVariant[selected.statutConvention] ?? "neutral"}>{selected.statutConvention}</Badge>
                  <button type="button" onClick={() => openFichePrestataire(selected.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Imprimer la fiche"><Printer className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setShowEdit(true)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Modifier"><Pencil className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 w-fit">
                {([["fiche", "Fiche"], ["portail", "Portail"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setOngletDetail(id)}
                    className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${ongletDetail === id ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {ongletDetail === "portail" ? (
                <PortailTab prestataireId={selected.id} />
              ) : (
              <>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Secteur — détermine le taux du contrat appliqué au calcul d'une prise en charge dans cet établissement</p>
                <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 w-fit">
                  {(["Public", "Privé"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => handleDefinirSecteur(s)}
                      className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${selected.secteur === s ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                  {!selected.secteur && <span className="px-2 text-[11px] text-muted-foreground">Non renseigné</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <Star className="w-4 h-4 text-primary mb-1" />
                  <p className="text-sm font-bold text-foreground">{selected.scoreQualite ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Score qualité</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <Clock className="w-4 h-4 text-primary mb-1" />
                  <p className="text-sm font-bold text-foreground">{selected.delaiPaiementMoyen ? `${selected.delaiPaiementMoyen} j` : "—"}</p>
                  <p className="text-xs text-muted-foreground">Délai paiement moyen</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3">
                  <Building2 className="w-4 h-4 text-primary mb-1" />
                  <p className="text-sm font-bold text-foreground">{selected.dateConventionnement ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Date conventionnement</p>
                </div>
              </div>

              <div className={`rounded-lg p-3 border ${selected.tpsAssujetti ? "bg-primary/5 border-primary/25" : "bg-secondary/30 border-border"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <ReceiptText className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">TPS {selected.tpsAssujetti ? "— Assujetti (9,5%)" : "— Non assujetti"}</p>
                </div>
                {selected.tpsAssujetti && (
                  <p className="text-xs text-muted-foreground">
                    Depuis le {selected.tpsDateEffet ?? "—"}{selected.tpsDateArret ? ` jusqu'au ${selected.tpsDateArret}` : " (sans date d'arrêt)"} — sur toutes les prestations, sauf chambre/hébergement et médicaments.
                  </p>
                )}
              </div>

              {statistiques && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Ententes préalables</p>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-foreground">{statistiques.ententesPrealables.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-green-500">{statistiques.ententesPrealables.accordees}</p>
                        <p className="text-[10px] text-muted-foreground">Accordées</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-red-400">{statistiques.ententesPrealables.refusees}</p>
                        <p className="text-[10px] text-muted-foreground">Refusées</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-yellow-500">{statistiques.ententesPrealables.enAttente}</p>
                        <p className="text-[10px] text-muted-foreground">En attente</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-primary">{statistiques.ententesPrealables.transformeesEnFacture}</p>
                        <p className="text-[10px] text-muted-foreground">→ Facture</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><FileStack className="w-3.5 h-3.5" />Factures</p>
                    <div className="grid grid-cols-5 gap-2">
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-foreground">{statistiques.factures.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-foreground">{statistiques.factures.enSaisie}</p>
                        <p className="text-[10px] text-muted-foreground">En saisie</p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-red-400">{statistiques.factures.annulees}</p>
                        <p className="text-[10px] text-muted-foreground">Annulées</p>
                      </div>
                      <div className="bg-green-500/10 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-green-500">{statistiques.factures.reglees}</p>
                        <p className="text-[10px] text-muted-foreground">Réglées</p>
                      </div>
                      <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
                        <p className="text-sm font-bold text-yellow-500">{statistiques.factures.enAttenteReglement}</p>
                        <p className="text-[10px] text-muted-foreground">En attente</p>
                      </div>
                    </div>
                  </div>

                  {statistiques.exercices.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Historique par exercice</p>
                      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-border bg-secondary/20">
                              {["Exercice", "Factures", "Déclaré", "Payé", "En attente", "Rejeté"].map((h) => (
                                <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {statistiques.exercices.map((e) => (
                              <tr key={e.annee} className="border-b border-border/50">
                                <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{e.annee}</td>
                                <td className="px-3 py-1.5 text-center whitespace-nowrap text-foreground">{e.nbFactures}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(e.montantDeclare)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-green-500" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(e.montantPaye)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-yellow-500" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(e.montantEnAttente)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-red-400" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(e.montantRejete)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {statistiques.lignes.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Détail des prestations — qui, quand, montants</p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="max-h-72 overflow-y-auto overflow-x-auto">
                          <table className="w-full text-[12px]">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b border-border bg-secondary/20">
                                {["Date de soin", "Assuré", "Facture", "Frais réel", "Remboursé", "Statut"].map((h) => (
                                  <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {statistiques.lignes.map((l, i) => (
                                <tr key={`${l.factureId}-${i}`} className="border-b border-border/50">
                                  <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.date}</td>
                                  <td className="px-3 py-1.5 font-semibold text-foreground whitespace-nowrap">{l.assureNom}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.factureReference}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-green-500" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montantRembourse)}</td>
                                  <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.statutReglement}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-2">Grille tarifaire</p>
                <div className="space-y-1.5">
                  {selected.grillesTarifaires.map((g) => (
                    <div key={g.acte} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30">
                      <span className="text-sm text-foreground">{g.acte}</span>
                      <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.plafond)} FCFA</span>
                    </div>
                  ))}
                  {selected.grillesTarifaires.length === 0 && <p className="text-xs text-muted-foreground">Aucune grille tarifaire renseignée</p>}
                </div>
              </div>

              {selected.motifSuspension && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
                  <ShieldOff className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{selected.motifSuspension}</p>
                </div>
              )}

              {selected.statutConvention === "Suspendu" ? (
                <Btn variant="secondary" onClick={handleRehabiliter}><ShieldCheck className="w-4 h-4" />Réhabiliter le prestataire</Btn>
              ) : (
                <Btn variant="secondary" onClick={handleSuspendre}><ShieldOff className="w-4 h-4" />Suspendre le prestataire</Btn>
              )}
              </>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un prestataire</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && <PrestataireForm onClose={() => setShowCreate(false)} onSaved={handleSaved} />}
      {showEdit && selected && <PrestataireForm prestataire={selected} onClose={() => setShowEdit(false)} onSaved={handleSaved} />}
    </div>
  );
}

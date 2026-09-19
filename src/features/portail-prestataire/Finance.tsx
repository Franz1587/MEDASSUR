import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { parse, isValid } from "date-fns";
import { ArrowLeft, Eye, FileDown, Plus, Search, RotateCcw, X } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import {
  getApercuReleves, getReleves, creerReleve, voirDocumentReleve, getReleveDetail, getPrestations, getMoiPrestataire,
  getFacturesEligiblesReleve, ajouterFactureReleve, retirerFactureReleve,
  type LotProposeReleve, type Releve, type ReleveDetail, type Prestation, type FactureEligibleReleve,
} from "@/services/portailPrestataire.service";

// Statut réel, temps réel (2026-08) — voir demande utilisateur : "le statut
// d'une facture ou d'un relevé de facture doit remonter en temps réel en
// fonction du traitement fait côté assurance".
function statutReelVariant(s: string): BadgeVariant {
  if (s === "Payée" || s === "Payé" || s === "Validé") return "success";
  if (s === "Rejeté" || s === "Annulée") return "danger";
  if (s === "Reçu" || s === "En validation" || s === "Soumise — en attente de règlement" || s === "En cours de traitement" || s === "En attente de règlement") return "warning";
  return "neutral";
}

// "dd/mm/yyyy" — même repère que partout ailleurs dans l'app.
function parseFr(s: string): Date | null {
  const d = parse(s, "dd/MM/yyyy", new Date());
  return isValid(d) ? d : null;
}
function dansPeriode(dateFr: string, du: string, au: string): boolean {
  const d = parseFr(dateFr);
  if (!d) return true;
  const bDu = du ? parseFr(du) : null;
  const bAu = au ? parseFr(au) : null;
  if (bDu && d < bDu) return false;
  if (bAu && d > bAu) return false;
  return true;
}

// Filtre par intervalle de dates sur une période "Mois Année" (2026-08) —
// voir demande utilisateur : "corrige cela partout, ça existe dans l'écran
// prestataire" : deux zones de saisie Du/Au, jamais un champ texte libre
// pour la période — un lot du mois d'Août 2026 correspond dès que
// l'intervalle [du, au] recoupe ce mois (comparaison par mois entier, pas
// par jour exact).
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function debutPeriode(periode: string): Date | null {
  const [nomMois, annee] = periode.trim().toLowerCase().split(" ");
  const mois = MOIS_FR.indexOf(nomMois);
  if (mois === -1 || !annee) return null;
  return new Date(Number(annee), mois, 1);
}
function finPeriode(periode: string): Date | null {
  const debut = debutPeriode(periode);
  return debut ? new Date(debut.getFullYear(), debut.getMonth() + 1, 0) : null;
}
function periodeDansIntervalle(periode: string, du: string, au: string): boolean {
  const debut = debutPeriode(periode);
  const fin = finPeriode(periode);
  if (!debut || !fin) return true;
  const bDu = du ? parseFr(du) : null;
  const bAu = au ? parseFr(au) : null;
  if (bDu && fin < bDu) return false;
  if (bAu && debut > bAu) return false;
  return true;
}

type Onglet = "lots" | "releves" | "factures";
const ONGLETS: { cle: Onglet; label: string }[] = [
  { cle: "lots", label: "Lots proposés — à créer" },
  { cle: "releves", label: "Liste Relevés créés" },
  { cle: "factures", label: "Toutes les factures déclarées" },
];

const fieldCls = "h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground";

// Gestion financière — Relevé de facture (2026-08) — voir demande
// utilisateur : "dans l'onglet gestionnaire financière on aura une rubrique
// relevé de facture... l'application regroupe systématiquement les
// factures... La gestion financière c'est là où on fait les factures,
// c'est aussi là qu'on peut faire le point entre les factures déclarées et
// celles progressivement réglées par un Règlement comptable. Les agents
// ayant accès à cette rubrique doivent voir toutes les factures saisies,
// quel que soit le service à l'origine de la saisie" — toutes les requêtes
// du portail sont déjà scopées par établissement (Prestataire), jamais par
// utilisateur individuel. Les trois rubriques sont des sous-onglets
// distincts (2026-08) — voir demande utilisateur : "il faut que tu mettes
// ces rubriques en sous-menu de gestion financière et non sur la même
// page" — chacun avec ses propres filtres de recherche dédiés (référence,
// nom, date/période).
export default function PrestataireFinanceView() {
  const [onglet, setOnglet] = useState<Onglet>("lots");
  const [detailReleve, setDetailReleve] = useState<ReleveDetail | null>(null);

  const [lots, setLots] = useState<LotProposeReleve[] | null>(null);
  const [releves, setReleves] = useState<Releve[] | null>(null);
  const [factures, setFactures] = useState<Prestation[] | null>(null);
  const [creation, setCreation] = useState<string | null>(null); // clé "clientId|periode" en cours de création
  const [tpsAssujetti, setTpsAssujetti] = useState(false);

  // Saisie des critères (2026-08) — voir demande utilisateur : "je veux des
  // zones de saisie de date séparées et non le système actuel, et le
  // bouton rechercher pour lancer la requête" : le filtre ne s'applique
  // qu'au clic sur "Rechercher" pour chaque onglet, jamais à la frappe.
  const [lotsSouscripteur, setLotsSouscripteur] = useState("");
  const [lotsDu, setLotsDu] = useState("");
  const [lotsAu, setLotsAu] = useState("");
  const [filtreLots, setFiltreLots] = useState({ souscripteur: "", du: "", au: "" });

  const [relevesReference, setRelevesReference] = useState("");
  const [relevesSouscripteur, setRelevesSouscripteur] = useState("");
  const [relevesDu, setRelevesDu] = useState("");
  const [relevesAu, setRelevesAu] = useState("");
  const [filtreReleves, setFiltreReleves] = useState({ reference: "", souscripteur: "", du: "", au: "" });

  const [facturesReference, setFacturesReference] = useState("");
  const [facturesNom, setFacturesNom] = useState("");
  const [facturesDu, setFacturesDu] = useState("");
  const [facturesAu, setFacturesAu] = useState("");
  const [filtreFactures, setFiltreFactures] = useState({ reference: "", nom: "", du: "", au: "" });

  const rafraichir = () => {
    getApercuReleves().then(setLots);
    getReleves().then(setReleves);
    getPrestations().then(setFactures);
  };
  useEffect(() => { rafraichir(); getMoiPrestataire().then((p) => setTpsAssujetti(p.tpsAssujetti)); }, []);

  const lotsFiltres = useMemo(() => (lots ?? []).filter((l) =>
    l.clientNom.toLowerCase().includes(filtreLots.souscripteur.trim().toLowerCase())
    && periodeDansIntervalle(l.periode, filtreLots.du, filtreLots.au)), [lots, filtreLots]);
  const lancerRechercheLots = () => setFiltreLots({ souscripteur: lotsSouscripteur, du: lotsDu, au: lotsAu });
  const reinitialiserLots = () => { setLotsSouscripteur(""); setLotsDu(""); setLotsAu(""); setFiltreLots({ souscripteur: "", du: "", au: "" }); };
  const rechercheLotsActive = filtreLots.souscripteur || filtreLots.du || filtreLots.au;

  const relevesFiltres = useMemo(() => (releves ?? []).filter((r) =>
    r.numero.toLowerCase().includes(filtreReleves.reference.trim().toLowerCase())
    && r.client.nom.toLowerCase().includes(filtreReleves.souscripteur.trim().toLowerCase())
    && periodeDansIntervalle(r.periode, filtreReleves.du, filtreReleves.au)), [releves, filtreReleves]);
  const lancerRechercheReleves = () => setFiltreReleves({ reference: relevesReference, souscripteur: relevesSouscripteur, du: relevesDu, au: relevesAu });
  const reinitialiserReleves = () => { setRelevesReference(""); setRelevesSouscripteur(""); setRelevesDu(""); setRelevesAu(""); setFiltreReleves({ reference: "", souscripteur: "", du: "", au: "" }); };
  const rechercheRelevesActive = filtreReleves.reference || filtreReleves.souscripteur || filtreReleves.du || filtreReleves.au;

  const facturesFiltrees = useMemo(() => (factures ?? []).filter((f) =>
    f.referenceFacture.toLowerCase().includes(filtreFactures.reference.trim().toLowerCase())
    && (filtreFactures.nom.trim() === "" || f.lignes.some((l) => l.assureNom.toLowerCase().includes(filtreFactures.nom.trim().toLowerCase())))
    && dansPeriode(f.dateReception, filtreFactures.du, filtreFactures.au)), [factures, filtreFactures]);
  const lancerRechercheFactures = () => setFiltreFactures({ reference: facturesReference, nom: facturesNom, du: facturesDu, au: facturesAu });
  const reinitialiserFactures = () => { setFacturesReference(""); setFacturesNom(""); setFacturesDu(""); setFacturesAu(""); setFiltreFactures({ reference: "", nom: "", du: "", au: "" }); };
  const rechercheFacturesActive = filtreFactures.reference || filtreFactures.nom || filtreFactures.du || filtreFactures.au;

  const creer = async (lot: LotProposeReleve) => {
    const cle = `${lot.clientId}|${lot.periode}`;
    setCreation(cle);
    try {
      const releve = await creerReleve(lot.clientId, lot.periode);
      toast.success(`Relevé ${releve.numero} créé.`);
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreation(null);
    }
  };

  const voir = async (id: string, format: "pdf" | "xlsx" = "pdf") => {
    try {
      await voirDocumentReleve(id, format);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Document indisponible.");
    }
  };

  // Détail ligne à ligne (2026-08) — voir demande utilisateur : "le relevé
  // de facture doit remonter chaque ligne de facture avec le détail (date
  // de prestation, personne, frais réel, part assurance, part patient, net
  // à payer, total des lignes... la même logique que le règlement maladie)".
  const ouvrirDetail = async (id: string) => {
    try {
      setDetailReleve(await getReleveDetail(id));
      setEligibles(null);
      setAjoutOuvert(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relevé indisponible.");
    }
  };

  // Ajout / retrait d'une facture (2026-08) — voir demande utilisateur :
  // "on doit pouvoir ajouter ou retirer une facture d'un relevé".
  const [factureEnRetrait, setFactureEnRetrait] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [eligibles, setEligibles] = useState<FactureEligibleReleve[] | null>(null);
  const [factureEnAjout, setFactureEnAjout] = useState<string | null>(null);

  const retirer = async (factureId: string) => {
    if (!detailReleve) return;
    setFactureEnRetrait(factureId);
    try {
      setDetailReleve(await retirerFactureReleve(detailReleve.id, factureId));
      toast.success("Facture retirée du relevé.");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrait impossible.");
    } finally {
      setFactureEnRetrait(null);
    }
  };

  const ouvrirAjout = async () => {
    if (!detailReleve) return;
    setAjoutOuvert(true);
    try {
      setEligibles(await getFacturesEligiblesReleve(detailReleve.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liste indisponible.");
    }
  };

  const ajouter = async (factureId: string) => {
    if (!detailReleve) return;
    setFactureEnAjout(factureId);
    try {
      const mis = await ajouterFactureReleve(detailReleve.id, factureId);
      setDetailReleve(mis);
      setEligibles((v) => v?.filter((f) => f.id !== factureId) ?? null);
      toast.success("Facture ajoutée au relevé.");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout impossible.");
    } finally {
      setFactureEnAjout(null);
    }
  };

  if (detailReleve) {
    // Une ligne par facture, pas par acte (2026-08) — voir demande
    // utilisateur : "il n'est pas nécessaire d'éclater une facture dans un
    // relevé de facture... le relevé de facture tient compte de la somme
    // des consommations d'un patient par rapport à une même référence de
    // facture" — detailReleve.factures est déjà agrégé côté serveur (voir
    // RelevesPrestataireService.agregerLignesFacture), fusionné ici avec
    // l'ancien tableau "Factures de ce relevé" (même granularité désormais).
    const factures = detailReleve.factures;
    const totalFrais = factures.reduce((s, f) => s + f.montant, 0);
    const totalAssurance = factures.reduce((s, f) => s + (f.baseRemboursement ?? 0), 0);
    const totalPatient = factures.reduce((s, f) => s + (f.resteACharge ?? 0), 0);
    const totalNet = factures.reduce((s, f) => s + ((f.baseRemboursement ?? 0) - (f.montantTps ?? 0)), 0);
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={() => setDetailReleve(null)} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour aux relevés créés
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.2rem] font-bold text-foreground">Relevé {detailReleve.numero}</h1>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">{detailReleve.client.nom} · {detailReleve.periode}</p>
          </div>
          <div className="flex items-center gap-2">
            {detailReleve.statutReel && <Badge variant={statutReelVariant(detailReleve.statutReel.statut)}>{detailReleve.statutReel.statut}</Badge>}
            <button type="button" onClick={() => voir(detailReleve.id, "pdf")} title="Télécharger / imprimer en PDF" className="h-9 px-3.5 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" />PDF
            </button>
            <button type="button" onClick={() => voir(detailReleve.id, "xlsx")} title="Télécharger en Excel" className="h-9 px-3.5 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" />Excel
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-secondary/30 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-foreground">Factures de ce relevé</p>
            <button type="button" onClick={ouvrirAjout} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Ajouter une facture
            </button>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-2">Facture</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Patient</th>
                <th className="text-right px-3 py-2">Frais réel</th>
                <th className="text-right px-3 py-2">Part assurance</th>
                <th className="text-right px-3 py-2">Part patient</th>
                <th className="text-right px-3 py-2">Net à payer</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {factures.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2 text-foreground font-medium">{f.referenceFacture}</td>
                  <td className="px-3 py-2 text-muted-foreground">{f.date}</td>
                  <td className="px-3 py-2 text-foreground">{f.assureNom}</td>
                  <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(f.montant)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{f.baseRemboursement != null ? fmtM(f.baseRemboursement) : "—"}</td>
                  <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f.resteACharge != null ? fmtM(f.resteACharge) : "—"}</td>
                  <td className="px-3 py-2 text-right text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM((f.baseRemboursement ?? 0) - (f.montantTps ?? 0))}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button" onClick={() => retirer(f.id)} disabled={factureEnRetrait === f.id || factures.length === 1}
                      title={factures.length === 1 ? "Impossible de retirer la dernière facture d'un relevé" : "Retirer du relevé"}
                      className="h-7 px-2.5 rounded-lg border border-destructive/40 text-[11.5px] text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 disabled:opacity-40"
                    >
                      <X className="w-3 h-3" />{factureEnRetrait === f.id ? "…" : "Retirer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-foreground">Total — {detailReleve.nbFactures} facture(s)</td>
                <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalFrais)} FCFA</td>
                <td className="px-3 py-2 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalAssurance)} FCFA</td>
                <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPatient)} FCFA</td>
                <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalNet)} FCFA</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {ajoutOuvert && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-secondary/30 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-foreground">Factures éligibles — {detailReleve.client.nom}, {detailReleve.periode}</p>
              <button type="button" onClick={() => setAjoutOuvert(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
            {eligibles === null ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-[12.5px]">Chargement…</p>
            ) : eligibles.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-[12.5px]">Aucune facture éligible pour l'instant.</p>
            ) : (
              <table className="w-full text-[12.5px]">
                <tbody className="divide-y divide-border/60">
                  {eligibles.map((f) => (
                    <tr key={f.id}>
                      <td className="px-4 py-2 text-foreground font-medium">{f.referenceFacture}</td>
                      <td className="px-4 py-2 text-muted-foreground">{f.dateReception}</td>
                      <td className="px-4 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(f.montant)} FCFA</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button" onClick={() => ajouter(f.id)} disabled={factureEnAjout === f.id}
                          className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-medium inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          <Plus className="w-3 h-3" />{factureEnAjout === f.id ? "…" : "Ajouter"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Gestion financière</h1>

      <div className="flex border border-border rounded-lg overflow-hidden text-[12px] w-fit">
        {ONGLETS.map((o) => (
          <button
            key={o.cle} type="button" onClick={() => setOnglet(o.cle)}
            className={`px-3.5 py-2 transition-colors whitespace-nowrap ${onglet === o.cle ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "lots" && (
        <div className="space-y-3">
          <p className="text-[11.5px] text-muted-foreground">Vos factures saisies sont regroupées automatiquement par souscripteur et par période. Créez le relevé quand un lot est prêt à être transmis.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={lotsSouscripteur} onChange={(e) => setLotsSouscripteur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRechercheLots()} placeholder="Souscripteur…" className={`${fieldCls} w-52`} />
            <span className="text-[11.5px] text-muted-foreground">Du</span>
            <DateInput value={lotsDu} onChange={setLotsDu} className={`${fieldCls} w-32`} />
            <span className="text-[11.5px] text-muted-foreground">Au</span>
            <DateInput value={lotsAu} onChange={setLotsAu} className={`${fieldCls} w-32`} />
            <button type="button" onClick={lancerRechercheLots} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />Rechercher
            </button>
            {rechercheLotsActive && (
              <button type="button" onClick={reinitialiserLots} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
              </button>
            )}
          </div>
          {/* Détail ligne à ligne par lot (2026-08) — voir demande
              utilisateur : "on doit voir la liste des factures devant
              constituer le lot avec les noms des patients, la date de
              prestation, le montant des frais réel, la part de
              l'assurance, la part du patient, la TPS (si le prestataire y
              est assujetti) et le net à payer... les totaux par ligne de
              souscripteur et le bouton créer à côté de la ligne 'Total'". */}
          {lotsFiltres.map((l) => {
            const cle = `${l.clientId}|${l.periode}`;
            const totalFrais = l.lignes.reduce((s, x) => s + x.montant, 0);
            const totalAssurance = l.lignes.reduce((s, x) => s + (x.baseRemboursement ?? 0), 0);
            const totalPatient = l.lignes.reduce((s, x) => s + (x.resteACharge ?? 0), 0);
            const totalTps = l.lignes.reduce((s, x) => s + (x.montantTps ?? 0), 0);
            const totalNet = l.lignes.reduce((s, x) => s + ((x.baseRemboursement ?? 0) - (x.montantTps ?? 0)), 0);
            return (
              <div key={cle} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-secondary/30 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-foreground">{l.clientNom} <span className="text-muted-foreground font-normal">— {l.periode}</span></p>
                  <span className="text-[11px] text-muted-foreground">{l.nbFactures} facture(s)</span>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-4 py-2">Facture</th>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Patient</th>
                      <th className="text-right px-4 py-2">Frais réel</th>
                      <th className="text-right px-4 py-2">Part assurance</th>
                      <th className="text-right px-4 py-2">Part patient</th>
                      {tpsAssujetti && <th className="text-right px-4 py-2">TPS</th>}
                      <th className="text-right px-4 py-2">Net à payer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {l.lignes.map((x) => (
                      <tr key={x.id}>
                        <td className="px-4 py-2 text-foreground font-medium">{x.referenceFacture}</td>
                        <td className="px-4 py-2 text-muted-foreground">{x.date}</td>
                        <td className="px-4 py-2 text-foreground">{x.assureNom}</td>
                        <td className="px-4 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(x.montant)}</td>
                        <td className="px-4 py-2 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{x.baseRemboursement != null ? fmtM(x.baseRemboursement) : "—"}</td>
                        <td className="px-4 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{x.resteACharge != null ? fmtM(x.resteACharge) : "—"}</td>
                        {tpsAssujetti && <td className="px-4 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{x.montantTps != null && x.montantTps > 0 ? fmtM(x.montantTps) : "—"}</td>}
                        <td className="px-4 py-2 text-right text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM((x.baseRemboursement ?? 0) - (x.montantTps ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-secondary/30 font-semibold">
                      <td colSpan={2} className="px-4 py-2.5 text-foreground">Total</td>
                      <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalFrais)} FCFA</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalAssurance)} FCFA</td>
                      <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPatient)} FCFA</td>
                      {tpsAssujetti && <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalTps)} FCFA</td>}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalNet)} FCFA</span>
                          <button
                            type="button" onClick={() => creer(l)} disabled={creation === cle}
                            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <Plus className="w-3.5 h-3.5" />{creation === cle ? "Création…" : "Créer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
          {lots && lotsFiltres.length === 0 && (
            <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center text-muted-foreground text-[13px]">
              {rechercheLotsActive ? "Aucun lot ne correspond à cette recherche." : "Aucune facture en attente de regroupement."}
            </div>
          )}
          {!lots && (
            <div className="bg-card border border-border rounded-2xl px-4 py-8 text-center text-muted-foreground text-[13px]">Chargement…</div>
          )}
        </div>
      )}

      {onglet === "releves" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={relevesReference} onChange={(e) => setRelevesReference(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRechercheReleves()} placeholder="Référence (n° relevé)…" className={`${fieldCls} w-48`} />
            <input value={relevesSouscripteur} onChange={(e) => setRelevesSouscripteur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRechercheReleves()} placeholder="Souscripteur…" className={`${fieldCls} w-52`} />
            <span className="text-[11.5px] text-muted-foreground">Du</span>
            <DateInput value={relevesDu} onChange={setRelevesDu} className={`${fieldCls} w-32`} />
            <span className="text-[11.5px] text-muted-foreground">Au</span>
            <DateInput value={relevesAu} onChange={setRelevesAu} className={`${fieldCls} w-32`} />
            <button type="button" onClick={lancerRechercheReleves} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />Rechercher
            </button>
            {rechercheRelevesActive && (
              <button type="button" onClick={reinitialiserReleves} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
              </button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-4 py-2.5">N° relevé</th>
                  <th className="text-left px-4 py-2.5">Souscripteur</th>
                  <th className="text-left px-4 py-2.5">Période</th>
                  <th className="text-right px-4 py-2.5">Factures</th>
                  <th className="text-right px-4 py-2.5">Montant</th>
                  <th className="text-left px-4 py-2.5">Règlement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {relevesFiltres.map((r) => (
                  <tr key={r.id} className="hover:bg-secondary/25 cursor-pointer" onClick={() => ouvrirDetail(r.id)}>
                    <td className="px-4 py-2.5 text-foreground font-medium">{r.numero}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.client.nom}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.periode}</td>
                    <td className="px-4 py-2.5 text-right text-foreground">{r.nbFactures}</td>
                    <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.montantTotal)} FCFA</td>
                    <td className="px-4 py-2.5">{r.statutReel && <Badge variant={statutReelVariant(r.statutReel.statut)}>{r.statutReel.statut}</Badge>}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => ouvrirDetail(r.id)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />Voir
                        </button>
                        <button type="button" onClick={() => voir(r.id, "pdf")} title="Télécharger / imprimer en PDF" className="h-8 px-2.5 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1">
                          <FileDown className="w-3.5 h-3.5" />PDF
                        </button>
                        <button type="button" onClick={() => voir(r.id, "xlsx")} title="Télécharger en Excel" className="h-8 px-2.5 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1">
                          <FileDown className="w-3.5 h-3.5" />Excel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {releves && relevesFiltres.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{rechercheRelevesActive ? "Aucun relevé ne correspond à cette recherche." : "Aucun relevé créé pour l'instant."}</td></tr>
                )}
                {!releves && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onglet === "factures" && (
        <div className="space-y-3">
          <p className="text-[11.5px] text-muted-foreground">Toutes les factures saisies pour cet établissement, quel que soit le compte à l'origine de la saisie — pour faire le point entre les factures déclarées et celles progressivement réglées par un règlement comptable.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={facturesReference} onChange={(e) => setFacturesReference(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRechercheFactures()} placeholder="Référence…" className={`${fieldCls} w-44`} />
            <input value={facturesNom} onChange={(e) => setFacturesNom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRechercheFactures()} placeholder="Nom du patient…" className={`${fieldCls} w-52`} />
            <span className="text-[11.5px] text-muted-foreground">Du</span>
            <DateInput value={facturesDu} onChange={setFacturesDu} className={`${fieldCls} w-32`} />
            <span className="text-[11.5px] text-muted-foreground">Au</span>
            <DateInput value={facturesAu} onChange={setFacturesAu} className={`${fieldCls} w-32`} />
            <button type="button" onClick={lancerRechercheFactures} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />Rechercher
            </button>
            {rechercheFacturesActive && (
              <button type="button" onClick={reinitialiserFactures} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
              </button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Référence</th>
                  <th className="text-left px-4 py-2.5">Patient(s)</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-right px-4 py-2.5">Montant</th>
                  <th className="text-left px-4 py-2.5">Règlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {facturesFiltrees.map((f) => (
                  <tr key={f.id} className="hover:bg-secondary/25">
                    <td className="px-4 py-2.5 text-foreground font-medium">{f.referenceFacture}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{[...new Set(f.lignes.map((l) => l.assureNom))].join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{f.dateReception}</td>
                    <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(f.lignes.reduce((s, l) => s + l.montant, 0))} FCFA</td>
                    <td className="px-4 py-2.5">{f.statutReel && <Badge variant={statutReelVariant(f.statutReel.statut)}>{f.statutReel.statut}</Badge>}</td>
                  </tr>
                ))}
                {factures && facturesFiltrees.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{rechercheFacturesActive ? "Aucune facture ne correspond à cette recherche." : "Aucune facture saisie pour l'instant."}</td></tr>
                )}
                {!factures && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

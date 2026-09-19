import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Search, User, ArrowLeft, CheckCircle2, Hash, History, FileDown, CheckCheck } from "lucide-react";
import { DateInput } from "@/components/shared/DateInput";
import { Badge } from "@/components/shared/Badge";
import { LABEL_STATUT_BON, VARIANT_STATUT_BON } from "@/lib/statutBon";
import { openDocument } from "@/services/documents.service";
import {
  getMoiPrestataire, rechercherPatients, apercuLignePrestation,
  type CanalRecherchePatient, type PatientFamilleMembre, type ApercuLignePrestation,
} from "@/services/portailPrestataire.service";
import { rechercherBon, bonsEnAttente, bonsTraitesPar, traiterBon, type BonTrouve, type LigneBon } from "@/services/prescriptions.service";

const LABEL_CANAL: Record<CanalRecherchePatient, string> = { telephone: "N° Téléphone", matricule: "N° Matricule", numeroAssure: "N° Adhérent" };
const TYPES_EXAMEN = ["Hôpital", "Clinique", "Cabinet", "Laboratoire"];
const TYPES_ORDONNANCE = ["Pharmacie", "Dépôt pharmaceutique"];

function todayFr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function resteA(l: LigneBon): number {
  return l.quantite - l.quantiteTraitee;
}

// Traiter un bon (2026-08) — voir demande utilisateur : "on doit directement
// pouvoir renseigner la référence d'un bon depuis cette page ou rechercher
// un assuré et en le sélectionnant, on doit voir le bon qui est en attente
// de traitement." Deux points d'entrée indépendants, jamais l'un forcé
// avant l'autre : (1) saisir directement le numéro du bon — le patient est
// révélé par le bon lui-même, comme un papier d'ordonnance physique ; (2)
// identifier l'assuré — la liste de ses bons en attente s'affiche
// automatiquement, sans numéro à connaître. Un seul écran, adapté selon le
// type d'établissement — jamais les deux à la fois (labos/cliniques
// traitent les examens, pharmacies/dépôts traitent les ordonnances).
//
// Traitement partiel multi-prestataire (2026-08) — voir demande
// utilisateur : "la deuxième pharmacie doit pouvoir [voir le] produit servi
// par la précédente... si la première pharmacie avait servi une quantité
// insuffisante..., alors la deuxième pharmacie pourra servir le reste."
// Toutes les lignes du bon sont affichées, y compris déjà traitées
// (non sélectionnables, "Déjà servi") — seul le reste (quantite -
// quantiteTraitee) peut être retraité.
export default function TraiterBonView() {
  const [type, setType] = useState<string | null>(null);

  const [numeroDirect, setNumeroDirect] = useState("");
  const [rechercheDirecte, setRechercheDirecte] = useState(false);

  const [canal, setCanal] = useState<CanalRecherchePatient>("telephone");
  const [valeur, setValeur] = useState("");
  const [recherche, setRecherche] = useState(false);
  const [famille, setFamille] = useState<PatientFamilleMembre[] | null>(null);
  const [bonsDisponibles, setBonsDisponibles] = useState<BonTrouve[] | null>(null);
  const [chargementBons, setChargementBons] = useState(false);

  const [bon, setBon] = useState<BonTrouve | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  // Montant/Quantité pré-remplis depuis le catalogue (2026-08) — voir
  // demande utilisateur : "les produits sont également côté pharmacie, les
  // montants des produits et les quantités doivent remonter. La pharmacie
  // peut changer le prix manuellement ou la quantité." Toujours modifiables
  // ensuite — le pré-remplissage n'est qu'un point de départ. La quantité
  // ne peut jamais dépasser le reste disponible (voir resteA ci-dessus).
  const [montants, setMontants] = useState<Record<string, string>>({});
  const [quantites, setQuantites] = useState<Record<string, string>>({});
  // Aperçu de la quote-part (2026-08) — voir demande utilisateur :
  // "l'application doit calculer les côtes part afin que l'assuré sache
  // combien il doit payer" — même moteur que "Nouvelle prestation"
  // (apercuLignePrestation), recalculé à chaque changement de montant/qté.
  const [apercus, setApercus] = useState<Record<string, ApercuLignePrestation | null>>({});
  const [chargementApercu, setChargementApercu] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(todayFr());
  const [traitement, setTraitement] = useState(false);

  // Historique des bons déjà traités PAR CE prestataire (2026-08) — voir
  // demande utilisateur (correction) : "ne doivent apparaître ici que les
  // bons qui ont déjà été traités par la pharmacie... ça ne doit [pas]
  // directement apparaître comme ça chez tous les prestataires" — affiché
  // par défaut, jamais la file de tous les bons en attente de tout le monde.
  const [historique, setHistorique] = useState<BonTrouve[] | null>(null);

  useEffect(() => { getMoiPrestataire().then((p) => setType(p.type)); }, []);

  const modeExamen = type ? TYPES_EXAMEN.includes(type) : false;
  const modeOrdonnance = type ? TYPES_ORDONNANCE.includes(type) : false;

  const chargerHistorique = () => {
    if (!modeExamen && !modeOrdonnance) return;
    bonsTraitesPar(modeExamen ? "Examen" : "Ordonnance").then(setHistorique).catch(() => setHistorique([]));
  };
  useEffect(chargerHistorique, [modeExamen, modeOrdonnance]);

  // Ouvre un bon et pré-remplit montant/quantité de chaque ligne PAS ENCORE
  // ENTIÈREMENT TRAITÉE, à hauteur du reste disponible (2026-08) — voir
  // demande utilisateur ci-dessus. Sans prix de référence connu (acte hors
  // catalogue), le champ reste vide comme avant, à saisir manuellement.
  const ouvrirBon = (b: BonTrouve) => {
    setBon(b);
    setSelection({}); setApercus({}); setChargementApercu({});
    const q: Record<string, string> = {}; const m: Record<string, string> = {};
    for (const l of b.lignes) {
      const reste = resteA(l);
      if (reste <= 0) continue;
      q[l.id] = String(reste);
      if (l.prixDefaut != null) m[l.id] = String(l.prixDefaut * reste);
    }
    setQuantites(q); setMontants(m);
  };

  const rafraichirApercu = async (assureId: string, l: LigneBon) => {
    const montant = Number(montants[l.id]);
    if (!montant || montant <= 0) { setApercus((v) => ({ ...v, [l.id]: null })); return; }
    setChargementApercu((v) => ({ ...v, [l.id]: true }));
    try {
      const apercu = await apercuLignePrestation({
        assureId, typePrestation: "Ambulatoire", montant,
        acteMedicalId: l.acteMedicalId ?? undefined, quantite: Number(quantites[l.id]) || 1,
      });
      setApercus((v) => ({ ...v, [l.id]: apercu }));
    } catch {
      setApercus((v) => ({ ...v, [l.id]: null }));
    } finally {
      setChargementApercu((v) => ({ ...v, [l.id]: false }));
    }
  };

  // Modifier la quantité recalcule le montant depuis le prix de référence
  // (2026-08) — même convention que Prestations.tsx (majQuantiteEdition) :
  // modifier le montant directement ensuite reste toujours possible. Jamais
  // plus que le reste disponible sur cette ligne.
  const majQuantite = (l: LigneBon, quantite: number) => {
    const q = Math.min(Math.max(1, quantite), resteA(l));
    setQuantites((v) => ({ ...v, [l.id]: String(q) }));
    if (l.prixDefaut != null) setMontants((v) => ({ ...v, [l.id]: String(l.prixDefaut! * q) }));
  };

  const rechercherParNumero = async () => {
    if (!numeroDirect.trim()) { toast.error("Veuillez saisir le numéro du bon."); return; }
    setRechercheDirecte(true);
    try {
      const trouve = await rechercherBon(modeExamen ? "Examen" : "Ordonnance", numeroDirect.trim());
      if (trouve.statut === "Traite") { toast.error("Ce bon a déjà été entièrement traité."); return; }
      ouvrirBon(trouve);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bon introuvable.");
    } finally {
      setRechercheDirecte(false);
    }
  };

  const rechercherPatient = async () => {
    if (!valeur.trim()) { toast.error("Veuillez saisir une valeur de recherche."); return; }
    setRecherche(true);
    setFamille(null);
    setBonsDisponibles(null);
    try {
      const resultats = await rechercherPatients(canal, valeur.trim());
      if (resultats.length === 0) toast.error("Aucun assuré trouvé pour cette recherche.");
      setFamille(resultats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherche(false);
    }
  };

  // Sélectionner un assuré révèle directement ses bons en attente (2026-08)
  // — voir demande utilisateur : plus besoin de connaître/saisir le numéro.
  const choisirPatient = async (membre: PatientFamilleMembre) => {
    if (membre.statut !== "Actif") {
      toast.error("Désolé, traitement impossible pour ce patient car il n'est plus couvert.");
      return;
    }
    setChargementBons(true);
    setBonsDisponibles(null);
    try {
      const bons = await bonsEnAttente(modeExamen ? "Examen" : "Ordonnance", membre.id);
      if (bons.length === 0) toast.error("Aucun bon en attente pour ce patient.");
      setBonsDisponibles(bons);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setChargementBons(false);
    }
  };

  const toggle = (l: LigneBon) => {
    if (resteA(l) <= 0) return;
    const seraSelectionne = !selection[l.id];
    setSelection((v) => ({ ...v, [l.id]: seraSelectionne }));
    // Aperçu immédiat à la sélection (2026-08) — le montant est déjà
    // pré-rempli, pas besoin d'attendre un blur pour voir la quote-part.
    if (seraSelectionne && bon) rafraichirApercu(bon.assure.id, l);
  };

  const nouvelleRecherche = () => {
    setBon(null); setSelection({}); setMontants({}); setQuantites({}); setApercus({}); setChargementApercu({});
    setNumeroDirect(""); setFamille(null); setBonsDisponibles(null); setValeur("");
  };

  const traiter = async () => {
    if (!bon) return;
    const retenues = bon.lignes.filter((l) => selection[l.id]);
    if (retenues.length === 0) { toast.error("Sélectionnez au moins une ligne à traiter."); return; }
    for (const l of retenues) {
      if (!montants[l.id] || Number(montants[l.id]) <= 0) { toast.error(`Renseignez le montant pour "${l.libelle}".`); return; }
    }
    setTraitement(true);
    try {
      await traiterBon({
        assureId: bon.assure.id, date,
        lignes: retenues.map((l) => ({ ligneId: l.id, montant: Number(montants[l.id]), quantite: Number(quantites[l.id]) || undefined })),
      });
      toast.success("Bon traité — facture enregistrée.");
      nouvelleRecherche();
      chargerHistorique();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Traitement impossible.");
    } finally {
      setTraitement(false);
    }
  };

  // Totaux de la sélection — montant, base remboursée, reste à charge
  // (2026-08) — voir demande utilisateur : "en sélectionnant les
  // médicaments on doit toujours voir la ligne des totaux avec les quote
  // part assurance et assuré (patient)".
  const lignesSelectionnees = bon ? bon.lignes.filter((l) => selection[l.id]) : [];
  const totalMontant = lignesSelectionnees.reduce((s, l) => s + (Number(montants[l.id]) || 0), 0);
  const apercusPrets = lignesSelectionnees.every((l) => apercus[l.id]?.resteACharge != null);
  const totalBase = lignesSelectionnees.reduce((s, l) => s + (apercus[l.id]?.baseRemboursement ?? 0), 0);
  const totalResteACharge = lignesSelectionnees.reduce((s, l) => s + (apercus[l.id]?.resteACharge ?? 0), 0);

  const voirFeuilleSoins = () => bon && openDocument(`/portail-prestataire/bons/${bon.prescriptionId}/feuille-soins`);
  const voirFeuilleExamen = () => bon && openDocument(`/portail-prestataire/bons/${bon.prescriptionId}/feuille-examen`);

  if (type !== null && !modeExamen && !modeOrdonnance) {
    return (
      <div className="p-6">
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[13px] text-muted-foreground">Cet écran n'est pas disponible pour ce type d'établissement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-primary" />{modeExamen ? "Traiter un bon d'examen" : "Traiter une ordonnance"}</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Renseignez directement le numéro du {modeExamen ? "bon d'examen" : "de l'ordonnance"}, ou recherchez le patient pour voir ses bons en attente.
        </p>
      </div>

      {!bon ? (
        <>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5"><Hash className="w-4 h-4 text-primary" />Rechercher par numéro</p>
            <div className="flex gap-2">
              <input
                value={numeroDirect} onChange={(e) => setNumeroDirect(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rechercherParNumero()}
                placeholder={modeExamen ? "N° du bon d'examen (ex. FE-000001/2026)" : "N° de l'ordonnance (ex. FS-000001/2026)"}
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground"
                style={{ fontFamily: "'DM Mono', monospace" }}
              />
              <button type="button" onClick={rechercherParNumero} disabled={rechercheDirecte} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
                <Search className="w-4 h-4" />{rechercheDirecte ? "Recherche…" : "Rechercher"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
            <div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" />
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <p className="text-[13px] font-semibold text-foreground">Rechercher un assuré</p>
            <div className="flex gap-2">
              {(Object.keys(LABEL_CANAL) as CanalRecherchePatient[]).map((c) => (
                <button
                  key={c} type="button" onClick={() => setCanal(c)}
                  className={`h-9 px-3 rounded-lg border text-[12.5px] font-medium ${canal === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                >
                  {LABEL_CANAL[c]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={valeur} onChange={(e) => setValeur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rechercherPatient()}
                placeholder="Saisir la valeur de recherche"
                className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground"
              />
              <button type="button" onClick={rechercherPatient} disabled={recherche} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
                <Search className="w-4 h-4" />{recherche ? "Recherche…" : "Rechercher"}
              </button>
            </div>

            {famille && famille.length > 0 && !bonsDisponibles && !chargementBons && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {famille.map((m) => (
                  <button
                    key={m.id} type="button" onClick={() => choisirPatient(m)}
                    className="flex items-center gap-2.5 border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{m.nom} {m.prenom ?? ""}</p>
                      <p className="text-[11px] text-muted-foreground">{m.matricule}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {chargementBons && <p className="text-[12.5px] text-muted-foreground">Recherche des bons en attente…</p>}

            {bonsDisponibles && bonsDisponibles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground">Bons en attente pour {bonsDisponibles[0].assure.nom} {bonsDisponibles[0].assure.prenom ?? ""} :</p>
                {bonsDisponibles.map((b) => (
                  <button
                    key={b.prescriptionId} type="button" onClick={() => ouvrirBon(b)}
                    className="w-full flex items-center gap-3 border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{b.numero}</p>
                      <p className="text-[11px] text-muted-foreground">Prescrit par {b.medecinNom} le {b.date} — {b.lignes.length} ligne{b.lignes.length > 1 ? "s" : ""}</p>
                    </div>
                    <Badge variant={VARIANT_STATUT_BON[b.statut]}>{LABEL_STATUT_BON[b.statut]}</Badge>
                    <span className="text-primary text-[11.5px] flex-shrink-0">Ouvrir →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Historique des bons déjà traités par CE prestataire (2026-08)
              — voir demande utilisateur (correction) : "ne doivent
              apparaître ici que les bons qui ont déjà été traités par la
              pharmacie". Affiché par défaut, sans recherche préalable. */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
              <History className="w-4 h-4 text-primary" />
              Historique des {modeExamen ? "bons d'examen" : "ordonnances"} traités
            </p>
            {!historique ? (
              <p className="text-[12.5px] text-muted-foreground">Chargement…</p>
            ) : historique.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">Vous n'avez encore traité aucun {modeExamen ? "bon d'examen" : "ordonnance"}.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-3 py-2">Référence</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Patient</th>
                      <th className="text-left px-3 py-2">Prescrit par</th>
                      <th className="text-left px-3 py-2">Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {historique.map((b) => (
                      <tr key={b.prescriptionId} className="hover:bg-secondary/25 cursor-pointer" onClick={() => ouvrirBon(b)}>
                        <td className="px-3 py-2 font-medium text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{b.numero}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{b.date}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{b.assure.nom} {b.assure.prenom ?? ""}</p>
                          <p className="text-[11px] text-muted-foreground">{b.assure.matricule}</p>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{b.medecinNom}</td>
                        <td className="px-3 py-2"><Badge variant={VARIANT_STATUT_BON[b.statut]}>{LABEL_STATUT_BON[b.statut]}</Badge></td>
                        <td className="px-3 py-2 text-right text-primary text-[11.5px]">Ouvrir →</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={nouvelleRecherche} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />Nouvelle recherche
          </button>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-foreground">{bon.assure.nom} {bon.assure.prenom ?? ""} — {bon.assure.matricule}</p>
              <Badge variant={VARIANT_STATUT_BON[bon.statut]}>{LABEL_STATUT_BON[bon.statut]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{bon.numero} — Prescrit par {bon.medecinNom} le {bon.date}</p>
              {/* Feuille de Soins/Examen à jour, accessible avant même de
                  traiter (2026-08) — voir demande utilisateur : "chaque
                  pharmacie doit toujours pouvoir accéder à la feuille de
                  soins avec ses mises à jour, au moment de traiter
                  l'ordonnance". */}
              <button type="button" onClick={modeExamen ? voirFeuilleExamen : voirFeuilleSoins} className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline flex-shrink-0">
                <FileDown className="w-3.5 h-3.5" />{modeExamen ? "Feuille d'examen" : "Feuille de soins"}
              </button>
            </div>
          </div>

          {bon.lignes.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
                {bon.lignes.map((l) => {
                  const apercu = apercus[l.id];
                  const reste = resteA(l);
                  const dejaServi = reste <= 0;
                  return (
                    <div key={l.id} className={`px-3 py-2.5 ${dejaServi ? "" : "hover:bg-secondary/25"}`}>
                      <label className={`flex items-center gap-3 ${dejaServi ? "" : "cursor-pointer"}`}>
                        <input type="checkbox" checked={!!selection[l.id]} onChange={() => toggle(l)} disabled={dejaServi} className="w-3.5 h-3.5 accent-primary flex-shrink-0 disabled:opacity-40" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12.5px] font-medium truncate ${dejaServi ? "text-muted-foreground line-through" : "text-foreground"}`}>{l.libelle}</p>
                          {l.posologie && <p className="text-[11px] text-muted-foreground">{l.posologie}</p>}
                          {/* "Déjà servi" (2026-08) — voir demande utilisateur :
                              "la deuxième pharmacie doit pouvoir [voir le]
                              produit servi par la précédente... pourra voir
                              la mention déjà servi." */}
                          {l.quantiteTraitee > 0 && (
                            <p className="text-[10.5px] text-emerald-600 flex items-center gap-1 mt-0.5">
                              <CheckCheck className="w-3 h-3" />
                              {dejaServi ? "Déjà servi" : `${l.quantiteTraitee}/${l.quantite} déjà servi(s)`} — {reste > 0 ? `reste ${reste} à servir` : "rien à ajouter"}
                            </p>
                          )}
                        </div>
                        {!dejaServi && (
                          <>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-[10.5px] text-muted-foreground">Qté</span>
                              <input
                                type="number" min={1} max={reste}
                                value={quantites[l.id] ?? ""} onChange={(e) => majQuantite(l, Number(e.target.value))}
                                onBlur={() => selection[l.id] && bon && rafraichirApercu(bon.assure.id, l)}
                                disabled={!selection[l.id]}
                                className="w-14 h-8 px-1.5 rounded-md border border-border bg-background text-[12px] text-foreground text-right disabled:opacity-50"
                                style={{ fontFamily: "'DM Mono', monospace" }}
                              />
                            </div>
                            <input
                              type="number" min={0} placeholder="Montant"
                              value={montants[l.id] ?? ""} onChange={(e) => setMontants((v) => ({ ...v, [l.id]: e.target.value }))}
                              onBlur={() => selection[l.id] && bon && rafraichirApercu(bon.assure.id, l)}
                              disabled={!selection[l.id]}
                              className="w-28 h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground text-right disabled:opacity-50 flex-shrink-0"
                              style={{ fontFamily: "'DM Mono', monospace" }}
                            />
                          </>
                        )}
                      </label>
                      {/* Quote-part (2026-08) — voir demande utilisateur :
                          "l'application doit calculer les côtes part afin
                          que l'assuré sache combien il doit payer". */}
                      {selection[l.id] && !dejaServi && (
                        <p className="text-[11px] text-muted-foreground mt-1 pl-6">
                          {chargementApercu[l.id]
                            ? "Calcul de la quote-part…"
                            : apercu?.resteACharge != null
                              ? `Base remboursée : ${apercu.baseRemboursement?.toLocaleString("fr-FR")} FCFA (${apercu.tauxRemboursement}%) — reste à charge de l'assuré : ${apercu.resteACharge.toLocaleString("fr-FR")} FCFA`
                              : "Quote-part non calculable pour cette ligne."}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Ligne des totaux (2026-08) — voir demande utilisateur : "en
                  sélectionnant les médicaments on doit toujours voir la
                  ligne des totaux avec les quote part assurance et assuré
                  (patient)". */}
              {lignesSelectionnees.length > 0 && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[12.5px]">
                  <span className="font-semibold text-foreground">Total : {totalMontant.toLocaleString("fr-FR")} FCFA</span>
                  {apercusPrets ? (
                    <>
                      <span className="text-muted-foreground">Part MedAssur : <span className="font-medium text-foreground">{totalBase.toLocaleString("fr-FR")} FCFA</span></span>
                      <span className="text-muted-foreground">Part assuré : <span className="font-medium text-foreground">{totalResteACharge.toLocaleString("fr-FR")} FCFA</span></span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Calcul de la quote-part…</span>
                  )}
                </div>
              )}

              <label className="block max-w-xs">
                <div className="text-[12px] text-muted-foreground mb-1.5">Date</div>
                <DateInput value={date} onChange={setDate} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
              </label>
              <button type="button" onClick={traiter} disabled={traitement} className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
                <CheckCircle2 className="w-4 h-4" />{traitement ? "Traitement…" : "Traiter la sélection"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

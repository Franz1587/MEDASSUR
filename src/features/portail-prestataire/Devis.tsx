import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { parse, isValid } from "date-fns";
import { Plus, Trash2, ArrowLeft, Upload, Check, FileDown, Search, RotateCcw } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { messageErreur } from "@/lib/http";
import { getActesMedicaux } from "@/services/acteMedical.service";
import type { ActeMedical } from "@/types/acteMedical";
import {
  getDevis, creerDevis, uploaderOrdonnanceDevis, uploaderPieceDevis, voirCertificatDevis, getMoiPrestataire,
  type DevisMedical, type PatientDetail, type LigneDevisInput,
} from "@/services/portailPrestataire.service";
import { IdentificationAssure } from "./IdentificationAssure";
import { GROUPES_ACTES } from "./prestationTypes";

function decisionVariant(d: string): BadgeVariant {
  return d === "Accordé" ? "success" : d === "Refusé" ? "danger" : "warning";
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

type Vue = "liste" | "identification" | "creation" | "detail";

// Devis / demande de prise en charge (2026-08) — voir demande utilisateur :
// "la partie 'Devis' est une rubrique permettant au prestataire de faire une
// demande de prise en charge de tout type (selon son profil)... hospitalisation,
// actes d'imagerie... je parle bien de l'entente préalable". Même
// identification patient que "Créer une prestation" (voir Prestations.tsx),
// mêmes groupes d'actes filtrés par Prestataire.categoriesActesVisibles —
// un devis déposé ici est une vraie AccordPrealable, visible immédiatement
// dans la file de décision interne (origine "Portail Prestataire").
export default function PrestataireDevisView() {
  const [vue, setVue] = useState<Vue>("liste");
  const [liste, setListe] = useState<DevisMedical[] | null>(null);
  const [detail, setDetail] = useState<DevisMedical | null>(null);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [type, setType] = useState("Consultation");
  const [dateDemande, setDateDemande] = useState(new Date().toLocaleDateString("fr-FR"));
  const [lignesForm, setLignesForm] = useState<(LigneDevisInput & { libelle: string })[]>([]);
  const [acteAAjouter, setActeAAjouter] = useState<ActeMedical | null>(null);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [ordonnance, setOrdonnance] = useState<File | null>(null);
  const [devisFichier, setDevisFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Saisie des critères (2026-08) — voir demande utilisateur : "je veux des
  // zones de saisie de date séparées et non le système actuel, et le
  // bouton rechercher pour lancer la requête" : le filtre ne s'applique
  // qu'au clic sur "Rechercher", jamais à la frappe.
  const [rechercheRef, setRechercheRef] = useState("");
  const [recherchePatient, setRecherchePatient] = useState("");
  const [rechercheDu, setRechercheDu] = useState("");
  const [rechercheAu, setRechercheAu] = useState("");
  const [filtre, setFiltre] = useState({ ref: "", patient: "", du: "", au: "" });

  // Visibilité par profil (2026-08) — voir demande utilisateur : "même dans
  // l'ajout d'un nouvel acte à une facture, il faut tenir compte de la
  // famille d'actes auxquelles le prestataire a accès" — même filtre que
  // Prestations.tsx/IdentificationAssure.tsx ; vide = aucune restriction.
  const [categoriesActesVisibles, setCategoriesActesVisibles] = useState<string[]>([]);
  const groupesVisibles = useMemo(
    () => (categoriesActesVisibles.length > 0 ? GROUPES_ACTES.filter((g) => categoriesActesVisibles.includes(g.cle)) : GROUPES_ACTES),
    [categoriesActesVisibles],
  );

  const rafraichir = () => getDevis().then(setListe);
  useEffect(() => {
    rafraichir();
    getActesMedicaux().then(setActes);
    getMoiPrestataire().then((p) => setCategoriesActesVisibles(p.categoriesActesVisibles));
  }, []);

  // Défaut cohérent avec la visibilité (2026-08) — voir même correction
  // dans Prestations.tsx.
  useEffect(() => {
    if (groupesVisibles.length > 0 && !groupesVisibles.some((g) => g.cle === type)) {
      setType(groupesVisibles[0].cle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupesVisibles]);

  const listeFiltree = useMemo(() => {
    const ref = filtre.ref.trim().toLowerCase();
    const nom = filtre.patient.trim().toLowerCase();
    return (liste ?? []).filter((d) =>
      (d.id.toLowerCase().includes(ref) || d.type.toLowerCase().includes(ref))
      && (nom === "" || `${d.assure.nom} ${d.assure.prenom ?? ""}`.toLowerCase().includes(nom))
      && dansPeriode(d.dateDemande, filtre.du, filtre.au));
  }, [liste, filtre]);
  const rechercheActive = filtre.ref || filtre.patient || filtre.du || filtre.au;
  const lancerRecherche = () => setFiltre({ ref: rechercheRef, patient: recherchePatient, du: rechercheDu, au: rechercheAu });
  const reinitialiserRecherche = () => {
    setRechercheRef(""); setRecherchePatient(""); setRechercheDu(""); setRechercheAu("");
    setFiltre({ ref: "", patient: "", du: "", au: "" });
  };

  const groupeActif = GROUPES_ACTES.find((g) => g.cle === type);
  const actesFiltres = groupeActif ? actes.filter((a) => groupeActif.familles.includes(a.famille)) : actes;
  const totalDevis = lignesForm.reduce((s, l) => s + l.montantDevis, 0);

  const ajouterActe = (acte: ActeMedical | null) => {
    if (!acte) return;
    setLignesForm((v) => [...v, {
      acteMedicalId: acte.id, lettreCleCode: acte.lettreCleCode, coefficient: acte.coefficient,
      description: acte.libelle, plafondReference: acte.prixDefaut, montantDevis: acte.prixDefaut, libelle: acte.libelle,
    }]);
    setActeAAjouter(null);
  };
  const retirerLigne = (i: number) => setLignesForm((v) => v.filter((_, idx) => idx !== i));
  const majMontant = (i: number, montant: number) => setLignesForm((v) => v.map((l, idx) => (idx === i ? { ...l, montantDevis: montant } : l)));

  const ouvrirDetail = (d: DevisMedical) => { setDetail(d); setVue("detail"); };

  // Le prestataire n'a pas besoin de "créer" un patient, il doit
  // l'identifier — même principe que "Créer une prestation" (voir
  // Prestations.tsx).
  const ouvrirCreation = () => {
    if (patient) { setLignesForm([]); setVue("creation"); return; }
    setVue("identification");
  };

  const identifiePourCreation = (p: PatientDetail, groupeActe: string) => {
    setPatient(p);
    setType(groupeActe);
    setLignesForm([]);
    setVue("creation");
  };

  const allerListe = () => {
    setPatient(null);
    setDetail(null);
    setOrdonnance(null);
    setDevisFichier(null);
    setVue("liste");
  };

  const soumettre = async () => {
    if (!patient || !dateDemande) {
      toast.error("Date de la demande obligatoire.");
      return;
    }
    if (type === "Hospitalisation" && !ordonnance) {
      toast.error("Merci de joindre la déclaration d'hospitalisation.");
      return;
    }
    if (type !== "Hospitalisation" && !ordonnance && !devisFichier) {
      toast.error("Merci de joindre l'ordonnance ou le devis.");
      return;
    }
    setEnvoi(true);
    try {
      const cree = await creerDevis({ assureId: patient.id, type, dateDemande, lignes: lignesForm });
      if (ordonnance) await uploaderOrdonnanceDevis(cree.id, ordonnance);
      if (devisFichier) await uploaderPieceDevis(cree.id, devisFichier);
      toast.success("Devis envoyé à l'assurance.");
      rafraichir();
      allerListe();
    } catch (err) {
      toast.error(messageErreur(err, "Envoi impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  const voirCertificat = async (d: DevisMedical) => {
    try {
      await voirCertificatDevis(d.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Certificat indisponible.");
    }
  };

  if (vue === "identification") {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Identifier le patient</h1>
        <IdentificationAssure onNouvellePrestation={identifiePourCreation} titreAction="Nouveau devis" />
      </div>
    );
  }

  if (vue === "creation" && patient) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Nouveau devis</h1>

        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[13.5px] font-semibold text-foreground">{patient.nom} {patient.prenom ?? ""}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">Matricule {patient.matricule} · {patient.contrat.compagnie.nom}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Type de demande</div>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground">
                {groupesVisibles.map((g) => <option key={g.cle} value={g.cle}>{g.label}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Date de la demande</div>
              <DateInput value={dateDemande} onChange={setDateDemande} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
            </label>
          </div>

          <label className="block">
            <div className="text-[12px] text-muted-foreground mb-1.5">Ajouter un acte (facultatif)</div>
            <Combobox
              options={actesFiltres} value={acteAAjouter} onChange={ajouterActe}
              getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
              placeholder="Rechercher un acte…"
            />
          </label>

          {lignesForm.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
              {lignesForm.map((l, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-0 text-[12.5px] text-foreground truncate">{l.libelle}</span>
                  <input
                    type="number" value={l.montantDevis} onChange={(e) => majMontant(i, Number(e.target.value))}
                    className="w-28 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  />
                  <button type="button" onClick={() => retirerLigne(i)} className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 font-semibold">
                <span className="text-[12px] text-foreground">Total devis</span>
                <span className="text-[12.5px] text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalDevis)} FCFA</span>
              </div>
            </div>
          )}

          {type === "Hospitalisation" ? (
            // Hospitalisation (2026-08) — voir demande utilisateur : "pour
            // les demandes de prise en charge de type hospitalisation on ne
            // charge qu'un seul document que le prestataire a chez lui, il
            // s'agit de la déclaration d'hospitalisation" — un seul champ,
            // pas le duo ordonnance/devis des autres types de demande.
            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Déclaration d'hospitalisation *</div>
              <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input type="file" onChange={(e) => setOrdonnance(e.target.files?.[0] ?? null)} className="text-[12px] text-muted-foreground w-full" />
                {ordonnance && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
              </div>
            </label>
          ) : (
            <>
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Ordonnance {!devisFichier && "*"}</div>
                <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                  <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input type="file" onChange={(e) => setOrdonnance(e.target.files?.[0] ?? null)} className="text-[12px] text-muted-foreground w-full" />
                  {ordonnance && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </div>
              </label>
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Devis {!ordonnance && "*"}</div>
                <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                  <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input type="file" onChange={(e) => setDevisFichier(e.target.files?.[0] ?? null)} className="text-[12px] text-muted-foreground w-full" />
                  {devisFichier && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-1">Ordonnance ou devis obligatoire pour envoyer la demande.</p>
              </label>
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={allerListe} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
            <button type="button" onClick={soumettre} disabled={envoi} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-60">{envoi ? "Envoi…" : "Envoyer"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (vue === "detail" && detail) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.2rem] font-bold text-foreground">{detail.description || detail.type}</h1>
            {/* Référence de la prise en charge (2026-08) — voir demande
                utilisateur : "une fois la prise en charge accordée, au
                'DEVIS' on doit avoir la référence de la prise en charge qui
                doit remonter" — affichée dès la création, réutilisable
                ensuite pour rattacher la prestation d'hospitalisation
                effective (voir PriseEnCharge.accordPrealableId). */}
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Réf. {detail.id} · {detail.assure.nom} {detail.assure.prenom ?? ""} · {detail.dateDemande}</p>
          </div>
          <Badge variant={decisionVariant(detail.decision)}>{detail.decision}</Badge>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2 text-[12.5px]">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Analyse médicale</span><span className="text-foreground">{detail.statutAnalyseMedicale}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Validation financière</span><span className="text-foreground">{detail.statutValidationFinanciere}</span></div>
          {detail.montantDevis != null && (
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Devis</span><span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(Number(detail.montantDevis))} FCFA</span></div>
          )}
          {detail.montantAutorise != null && (
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Montant autorisé</span><span className="text-emerald-600 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(Number(detail.montantAutorise))} FCFA</span></div>
          )}
        </div>
        {detail.decision === "Accordé" && (
          <button type="button" onClick={() => voirCertificat(detail)} className="h-10 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 font-medium inline-flex items-center gap-1.5">
            <FileDown className="w-4 h-4" />Certificat de prise en charge
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Devis — demandes de prise en charge</h1>
        <button type="button" onClick={ouvrirCreation} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" />Nouveau devis
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={rechercheRef} onChange={(e) => setRechercheRef(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRecherche()}
          placeholder="Référence, type…"
          className="h-9 w-40 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
        <input
          value={recherchePatient} onChange={(e) => setRecherchePatient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRecherche()}
          placeholder="Nom du patient…"
          className="h-9 w-48 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
        <span className="text-[11.5px] text-muted-foreground">Du</span>
        <DateInput value={rechercheDu} onChange={setRechercheDu} className="h-9 w-32 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground" />
        <span className="text-[11.5px] text-muted-foreground">Au</span>
        <DateInput value={rechercheAu} onChange={setRechercheAu} className="h-9 w-32 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground" />
        <button type="button" onClick={lancerRecherche} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />Rechercher
        </button>
        {rechercheActive && (
          <button type="button" onClick={reinitialiserRecherche} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Référence</th>
              <th className="text-left px-4 py-2.5">Patient</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-right px-4 py-2.5">Devis</th>
              <th className="text-left px-4 py-2.5">Décision</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {listeFiltree.map((d) => (
              <tr key={d.id} className="hover:bg-secondary/25 cursor-pointer" onClick={() => ouvrirDetail(d)}>
                <td className="px-4 py-2.5 text-foreground font-medium">{d.id}</td>
                <td className="px-4 py-2.5 text-foreground">{d.assure.nom} {d.assure.prenom ?? ""}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.type}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.dateDemande}</td>
                <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{d.montantDevis != null ? `${fmtM(Number(d.montantDevis))} FCFA` : "—"}</td>
                <td className="px-4 py-2.5"><Badge variant={decisionVariant(d.decision)}>{d.decision}</Badge></td>
                <td className="px-4 py-2.5 text-right text-primary text-[11.5px]">Voir →</td>
              </tr>
            ))}
            {liste && listeFiltree.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{rechercheActive ? "Aucun devis ne correspond à cette recherche." : "Aucun devis pour l'instant."}</td></tr>
            )}
            {!liste && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

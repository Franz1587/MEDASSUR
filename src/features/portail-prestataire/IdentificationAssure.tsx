import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, User, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { assurePhotoUrl } from "@/services/sante.service";
import {
  rechercherPatients, getPatient, getMoiPrestataire, type CanalRecherchePatient, type PatientFamilleMembre, type PatientDetail,
} from "@/services/portailPrestataire.service";
import { GROUPES_ACTES } from "./prestationTypes";

const LABEL_TYPE: Record<string, string> = { AS: "Bénéficiaire Principal", CJ: "Conjoint(e)", EF: "Enfant" };
const LABEL_CANAL: Record<CanalRecherchePatient, string> = { telephone: "N° Téléphone", matricule: "N° Matricule", numeroAssure: "N° Adhérent" };

// Identification d'un assuré (2026-08) — voir demande utilisateur : "le
// prestataire n'a pas besoin de créer un patient, il doit l'identifier...
// cela permet de savoir à l'avance si la personne est toujours couverte par
// l'assurance ou pas". Bloc partagé par l'onglet Patients (consultation
// libre) ET par "Créer une prestation" (voir Prestations.tsx, capture de
// référence fournie par l'utilisateur, onglet "Identifier Un Assuré" +
// "Sélectionnez le patient concerné").
interface IdentificationAssureProps {
  onNouvellePrestation: (patient: PatientDetail, groupeActe: string) => void;
  // Libellé de la section finale (2026-08) — "Nouvelle prestation" par
  // défaut (voir Prestations.tsx), "Nouveau devis" quand ce même bloc sert
  // à identifier le patient AVANT une demande de prise en charge (voir
  // Devis.tsx) — même identification, action différente.
  titreAction?: string;
  // Recherche pré-remplie (2026-08) — voir demande utilisateur : "ajouter
  // des filtres dans les écrans patient pour qu'on puisse rechercher un
  // patient déjà existant".
  rechercheInitiale?: { canal: CanalRecherchePatient; valeur: string };
  // Patient déjà identifié (2026-08) — voir demande utilisateur : "si un
  // patient apparaît dans la liste des patients [Mes patients], on ne
  // l'identifie plus, mais on crée une nouvelle prestation, étant donné
  // qu'on peut déjà le rechercher et que son statut réel remonte en temps
  // réel" — id d'un AssureSante déjà connu (déjà servi par cet
  // établissement, statut déjà visible dans la liste) : ouvre directement
  // sa fiche, sans repasser par la recherche téléphone/matricule. Le
  // blocage "patient non couvert" reste appliqué (voir getPatient, 403
  // serveur si radié entre-temps).
  patientDirect?: string;
}

export function IdentificationAssure({ onNouvellePrestation, titreAction = "Nouvelle prestation", rechercheInitiale, patientDirect }: IdentificationAssureProps) {
  const [canal, setCanal] = useState<CanalRecherchePatient>(rechercheInitiale?.canal ?? "telephone");
  const [valeur, setValeur] = useState(rechercheInitiale?.valeur ?? "");
  const [recherche, setRecherche] = useState(false);
  const [famille, setFamille] = useState<PatientFamilleMembre[] | null>(null);
  const [selectionne, setSelectionne] = useState<PatientDetail | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [categoriesActesVisibles, setCategoriesActesVisibles] = useState<string[]>([]);

  useEffect(() => { getMoiPrestataire().then((p) => setCategoriesActesVisibles(p.categoriesActesVisibles)); }, []);
  // categoriesActesVisibles vide = aucune restriction (voir
  // Prestataire.categoriesActesVisibles) ; sinon ne propose que les groupes
  // pertinents pour ce type d'établissement (voir demande utilisateur :
  // "une pharmacie, un laboratoire n'aura pas besoin de consultation").
  const groupesProposes = categoriesActesVisibles.length > 0
    ? GROUPES_ACTES.filter((g) => categoriesActesVisibles.includes(g.cle))
    : GROUPES_ACTES;

  const rechercher = async (canalRecherche = canal, valeurRecherche = valeur) => {
    if (!valeurRecherche.trim()) { toast.error("Veuillez saisir une valeur de recherche."); return; }
    setRecherche(true);
    setFamille(null);
    setSelectionne(null);
    try {
      const resultats = await rechercherPatients(canalRecherche, valeurRecherche.trim());
      if (resultats.length === 0) toast.error("Aucun assuré trouvé pour cette recherche.");
      setFamille(resultats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherche(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (rechercheInitiale) rechercher(rechercheInitiale.canal, rechercheInitiale.valeur); }, [rechercheInitiale]);

  useEffect(() => {
    if (!patientDirect) return;
    setChargementDetail(true);
    getPatient(patientDirect)
      .then(setSelectionne)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Fiche indisponible."))
      .finally(() => setChargementDetail(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientDirect]);

  // Blocage patient désactivé (2026-08) — voir demande utilisateur :
  // "lorsqu'on veut identifier un assuré, s'il est déjà désactivé, on doit
  // avoir un message d'erreur disant 'Désolé, prestation impossible pour ce
  // patient car il n'est plus couvert'". Le statut du membre choisi est
  // déjà connu depuis la recherche (pas besoin d'attendre la fiche détail).
  const choisir = async (membre: PatientFamilleMembre) => {
    if (membre.statut !== "Actif") {
      toast.error("Désolé, prestation impossible pour ce patient car il n'est plus couvert.");
      return;
    }
    setChargementDetail(true);
    try {
      setSelectionne(await getPatient(membre.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fiche indisponible.");
    } finally {
      setChargementDetail(false);
    }
  };

  return (
    <div className="space-y-4">
      {!patientDirect && (
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-[13px] font-semibold text-foreground">Identifier un assuré</p>
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
            value={valeur} onChange={(e) => setValeur(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rechercher()}
            placeholder={canal === "telephone" ? "Saisir le numéro de téléphone" : canal === "matricule" ? "Saisir le matricule" : "Saisir le n° adhérent"}
            className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground"
          />
          <button type="button" onClick={() => rechercher()} disabled={recherche} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
            <Search className="w-4 h-4" />{recherche ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </div>
      )}

      {patientDirect && chargementDetail && !selectionne && (
        <div className="bg-card border border-border rounded-2xl p-5 text-center text-[13px] text-muted-foreground">Chargement de la fiche…</div>
      )}

      {famille && famille.length > 0 && !selectionne && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-[13px] font-semibold text-foreground">Sélectionnez le patient concerné</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {famille.map((m) => (
              <button
                key={m.id} type="button" onClick={() => choisir(m)} disabled={chargementDetail}
                className="flex items-center gap-2.5 border border-border rounded-xl p-3 text-left hover:border-primary/40 hover:bg-secondary/30 transition-colors disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {assurePhotoUrl(m.photo) ? <img src={assurePhotoUrl(m.photo)} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{m.nom} {m.prenom ?? ""}</p>
                  <p className="text-[11px] text-muted-foreground">{LABEL_TYPE[m.typeAssure ?? ""] ?? m.typeAssure ?? "—"}</p>
                </div>
                <Badge variant={m.statut === "Actif" ? "success" : "danger"}>{m.statut === "Actif" ? "Actif" : "Non couvert"}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectionne && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          {!patientDirect && (
            <button type="button" onClick={() => setSelectionne(null)} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />Revenir à l'identification du patient
            </button>
          )}

          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-xl bg-secondary/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {assurePhotoUrl(selectionne.photo) ? <img src={assurePhotoUrl(selectionne.photo)} alt="" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] flex-1">
              <div className="col-span-2">
                <p className="text-[15px] font-bold text-foreground">{selectionne.nom} {selectionne.prenom ?? ""}</p>
                <p className="text-muted-foreground">{LABEL_TYPE[selectionne.typeAssure ?? ""] ?? selectionne.typeAssure ?? "—"}</p>
              </div>
              <div><span className="text-muted-foreground">Date de naissance</span><p className="text-foreground font-medium">{selectionne.dateNaissance ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Matricule</span><p className="text-foreground font-medium">{selectionne.matricule}</p></div>
              <div><span className="text-muted-foreground">Mobile</span><p className="text-foreground font-medium">{selectionne.telephone ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Validité prise en charge</span><p className="text-foreground font-medium">Du {selectionne.contrat.dateDebut} au {selectionne.contrat.dateFin}</p></div>
              <div className="col-span-2"><span className="text-muted-foreground">Assureur / Souscripteur</span><p className="text-foreground font-medium">{selectionne.contrat.compagnie.nom} / {selectionne.contrat.client.nom}</p></div>
              <div><Badge variant={selectionne.statutCarte === "Active" ? "success" : "warning"}>{selectionne.statutCarte ?? "—"}</Badge></div>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="bg-secondary/40 px-3 py-2 text-[12px] font-semibold text-foreground">Liste des règles de prise en charge</div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="bg-secondary/20 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-3 py-2">Prestation</th>
                  <th className="text-left px-3 py-2">Taux (%)</th>
                  <th className="text-right px-3 py-2">Plafond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {selectionne.contrat.garanties.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 text-foreground">{g.libelle}</td>
                    <td className="px-3 py-2 text-foreground">{g.tauxApplicable != null ? `${g.tauxApplicable}%` : "—"}</td>
                    <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {g.plafondMontant != null ? `${fmtM(Number(g.plafondMontant))} FCFA` : g.plafondTexte ?? "—"}
                    </td>
                  </tr>
                ))}
                {selectionne.contrat.garanties.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Aucune garantie renseignée.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-foreground mb-2">{titreAction}</p>
            <div className="flex flex-wrap gap-2">
              {groupesProposes.map((g) => (
                <button key={g.cle} type="button" onClick={() => onNouvellePrestation(selectionne, g.cle)} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:border-primary/40 hover:bg-secondary/30">
                  {g.label}
                </button>
              ))}
              {groupesProposes.length === 0 && (
                <p className="text-[12px] text-muted-foreground">Aucun type de prestation configuré pour cet établissement.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { UploadCloud, Receipt, HandCoins, ClipboardCheck, Image as ImageIcon, FolderUp, FolderTree, CheckCircle2, AlertTriangle, Building2, FileText, Users, Globe2, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { ImportEnMasseModal } from "@/components/shared/ImportEnMasseModal";
import {
  telechargerModeleImportFactures, apercuImportFactures, confirmerImportFactures, type ImportFactureRow,
  telechargerModeleImportFacturesGlobal, importerFacturesGlobal, type ResultatImportFacturesGlobal,
  compterFacturesEnAttente, synchroniserFacturesEnAttente,
  telechargerModeleImportReglements, apercuImportReglements, confirmerImportReglements, type ImportReglementRow,
  telechargerModeleImportAccordsPrealables, apercuImportAccordsPrealables, confirmerImportAccordsPrealables, type ImportAccordPrealableRow,
  telechargerModeleImportAssures, apercuImportAssures, confirmerImportAssures, type ImportAssureRow,
  importerPhotosEnMasse,
} from "@/services/import.service";
import {
  compterPersonnesEnAttenteTransfert, getPersonnesEnAttenteTransfert, ignorerPersonneEnAttenteTransfert,
  analyserEcartsTauxContrat, type PersonneEnAttenteTransfert,
} from "@/services/sante.service";
import {
  telechargerModeleImportClients, apercuImportClients, confirmerImportClients, type ImportClientRow,
} from "@/services/clients.service";
import {
  telechargerModeleImportContrats, apercuImportContrats, confirmerImportContrats, type ImportContratRow, getContrats,
} from "@/services/contrats.service";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

// Import de données (Système) — 2026-08 — voir demande utilisateur : "pour
// permettre aux sociétés d'assurance qui voudraient changer de logiciel mais
// commencer à utiliser MedAssur, je voudrais que dans la partie Système, on
// puisse avoir un onglet import... importer les factures saisies, les
// règlements qui ont été faits, importer même les photos dans un dossier en
// une fois... les prises en charge" — puis, étendu : "il faut également
// prévoir l'import des souscripteurs, les contrats et les assurés et
// ayants droits. Harmonise les modèles existants pour ces rubriques."
// Souscripteurs (Clients) et Contrats avaient DÉJÀ leur propre import
// (ImportEnMasseModal, depuis leurs écrans respectifs) — simplement
// regroupés ici pour que TOUTE reprise d'antériorité se pilote depuis un
// seul endroit, sans dupliquer leur logique. Assurés/ayants droit
// harmonise l'ancien import "Population" (fichier .csv point-virgule,
// depuis l'onglet Population d'un contrat) sur ce même patron .xlsx.
// L'ordre des cartes suit l'ordre naturel d'une reprise : souscripteurs →
// contrats → assurés → historique (prises en charge/factures/règlements) →
// photos.
//
// Factures et Prises en charge rattachées à UN contrat (2026-08 — voir
// demande utilisateur : "rendre l'import des factures et des prises en
// charge possible pour un contrat comme avec modèle qui se génère pour
// que les données match avec la population du contrat... les factures
// doivent s'importer par numéro matricule ou le nom de l'assuré ou
// l'ayant droit") — même contrainte et même écran de choix que pour les
// Assurés (voir ChoixContratPuis ci-dessous, désormais partagé par les 3).
// Import global de factures "tous contrats confondus" (2026-08 — voir
// demande utilisateur : "il faut aussi une option de fichier d'import de
// tous les contrats confondus... juste faire remonter le numéro
// matricule... l'application seulement faire remonter les factures des
// matricules trouvés et mettre les autres en attente... synchroniser...
// gérer de façon optimum plus de 50000 lignes en une fois") — alternative
// à l'import par contrat ci-dessus, pour une reprise en masse sans devoir
// pré-trier le fichier par contrat.
type Categorie = "souscripteurs" | "contrats" | "assures" | "factures" | "facturesGlobal" | "reglements" | "accordsPrealables" | "photos" | null;

const CARTES: { id: Exclude<Categorie, null>; titre: string; description: string; icon: React.ElementType }[] = [
  { id: "souscripteurs", titre: "Souscripteurs", description: "Reprise des clients (personnes morales ou physiques) déjà connus de l'ancien système.", icon: Building2 },
  { id: "contrats", titre: "Contrats", description: "Reprise des contrats déjà en portefeuille, rattachés à leur souscripteur et leur compagnie.", icon: FileText },
  { id: "assures", titre: "Assurés et ayants droit", description: "Reprise de la population d'un contrat — assuré principal, conjoint, enfants (rattachement familial selon l'ordre des lignes).", icon: Users },
  { id: "accordsPrealables", titre: "Prises en charge", description: "Reprise des demandes d'entente préalable déjà instruites (accordées, refusées ou en cours).", icon: ClipboardCheck },
  { id: "factures", titre: "Factures", description: "Reprise des factures déjà saisies (en-tête + lignes de prestation) auprès de l'ancien système.", icon: Receipt },
  { id: "reglements", titre: "Règlements prestataires", description: "Reprise des règlements déjà effectués auprès des prestataires (bordereaux soldés).", icon: HandCoins },
  { id: "photos", titre: "Photos des bénéficiaires", description: "Import en une fois de tout un dossier de photos — chaque fichier doit être nommé avec le matricule du bénéficiaire.", icon: ImageIcon },
];

export default function ImportDonneesView() {
  const [ouvert, setOuvert] = useState<Categorie>(null);
  // File d'attente des factures "matricule pas encore chargé" (2026-08 —
  // voir demande utilisateur : "l'application devra systématiquement
  // synchroniser"). Rafraîchi à l'ouverture de l'écran et après toute
  // synchronisation (manuelle ou automatique, voir plus bas).
  const [enAttente, setEnAttente] = useState(0);
  const [synchronisation, setSynchronisation] = useState(false);

  // Personnes en attente de transfert (2026-09) — voir SanteService.
  // importPopulation : un matricule importé, déjà présent sur un autre
  // contrat, dont le statut n'affirme pas encore "Actif" pour CE contrat.
  // Se résout de lui-même au fil des imports suivants — pas de
  // "synchroniser" manuel ici, juste un suivi + une possibilité d'ignorer
  // une entrée qui ne correspond finalement pas à un vrai transfert.
  const [enAttenteTransfert, setEnAttenteTransfert] = useState(0);
  const [listeTransfert, setListeTransfert] = useState<PersonneEnAttenteTransfert[] | null>(null);

  const rafraichirEnAttente = () => { compterFacturesEnAttente().then((r) => setEnAttente(r.nombre)).catch(() => undefined); };
  const rafraichirEnAttenteTransfert = () => { compterPersonnesEnAttenteTransfert().then((r) => setEnAttenteTransfert(r.nombre)).catch(() => undefined); };
  useEffect(() => { rafraichirEnAttente(); rafraichirEnAttenteTransfert(); }, []);

  const toggleListeTransfert = async () => {
    if (listeTransfert) { setListeTransfert(null); return; }
    try {
      setListeTransfert(await getPersonnesEnAttenteTransfert());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible.");
    }
  };

  const handleIgnorerTransfert = async (id: string) => {
    try {
      await ignorerPersonneEnAttenteTransfert(id);
      setListeTransfert((v) => v?.filter((p) => p.id !== id) ?? null);
      rafraichirEnAttenteTransfert();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  // Analyse a posteriori des écarts de taux (2026-09) — voir
  // SanteService.analyserEcartsTauxContrat : détecte, dans les
  // prestations déjà en base, un changement de contrat jamais annoncé
  // (taux observé correspondant à un autre contrat du même souscripteur)
  // — signale dans la même file d'attente, ne bascule jamais seule.
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const handleAnalyserEcartsTaux = async () => {
    setAnalyseEnCours(true);
    try {
      const res = await analyserEcartsTauxContrat();
      rafraichirEnAttenteTransfert();
      if (res.detectes > 0) toast.success(`${res.detectes} écart(s) de taux détecté(s) — ajouté(s) à la file de transfert pour validation.`);
      else toast.info("Aucun écart de taux détecté.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse impossible.");
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const synchroniser = async (silencieux = false) => {
    setSynchronisation(true);
    try {
      const res = await synchroniserFacturesEnAttente();
      setEnAttente(res.restantes);
      if (!silencieux || res.synchronisees > 0) {
        if (res.synchronisees > 0) toast.success(`${res.synchronisees} facture(s) en attente synchronisée(s) vers leur contrat.`);
        else if (!silencieux) toast.info("Aucune facture en attente n'a pu être synchronisée pour l'instant.");
      }
    } catch (err) {
      if (!silencieux) toast.error(err instanceof Error ? err.message : "Synchronisation impossible.");
    } finally {
      setSynchronisation(false);
    }
  };

  return (
    <div>
      <ModuleHeader
        title="Import de données"
        subtitle="Reprise d'antériorité — pour une société d'assurance qui bascule vers MedAssur"
        icon={UploadCloud}
      />

      {enAttente > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12.5px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span><span className="font-semibold">{enAttente}</span> facture(s) importée(s) via "Factures — tous contrats" en attente : leur matricule ne correspond encore à aucune population chargée.</span>
          </p>
          <Btn variant="secondary" disabled={synchronisation} onClick={() => synchroniser(false)}>
            <RefreshCw className={`w-4 h-4 ${synchronisation ? "animate-spin" : ""}`} />Synchroniser maintenant
          </Btn>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          Analyse a posteriori : détecte, dans les prestations déjà en base, un changement de contrat jamais annoncé (taux de couverture observé correspondant à un autre contrat du même souscripteur — ex. changement de collège Agent/Cadre) — jamais de bascule automatique, seulement un signalement à confirmer ci-dessous.
        </p>
        <Btn variant="secondary" disabled={analyseEnCours} onClick={handleAnalyserEcartsTaux}>
          <RefreshCw className={`w-4 h-4 ${analyseEnCours ? "animate-spin" : ""}`} />Analyser les écarts de taux
        </Btn>
      </div>

      {enAttenteTransfert > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12.5px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span><span className="font-semibold">{enAttenteTransfert}</span> personne(s) en attente de transfert (matricule déjà présent sur un autre contrat, ou écart de taux détecté) — résolu automatiquement au prochain import qui confirmera leur statut, ou à valider manuellement ci-dessous.</span>
            </p>
            <Btn variant="secondary" onClick={toggleListeTransfert}>{listeTransfert ? "Masquer" : "Voir le détail"}</Btn>
          </div>
          {listeTransfert && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {listeTransfert.map((p) => (
                <div key={p.id} className="text-[11.5px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 flex items-start justify-between gap-2">
                  <span className="flex-1"><span className="font-semibold">{p.nom} {p.prenom ?? ""}</span> (matricule {p.matricule}) — {p.motif}</span>
                  <button type="button" onClick={() => handleIgnorerTransfert(p.id)} className="text-[11px] underline flex-shrink-0">Ignorer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CARTES.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-primary/12 rounded-xl border border-primary/25 flex-shrink-0">
                <c.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-foreground">{c.titre}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{c.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Btn variant="secondary" onClick={() => setOuvert(c.id)}><UploadCloud className="w-4 h-4" />Importer</Btn>
              {c.id === "factures" && (
                <button
                  type="button" onClick={() => setOuvert("facturesGlobal")}
                  title="Import global : matricule seul, recherché dans TOUS les contrats — les matricules pas encore chargés sont mis en attente."
                  className="text-[12px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Globe2 className="w-3.5 h-3.5" />Tous contrats confondus
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {ouvert === "souscripteurs" && (
        <ImportEnMasseModal<ImportClientRow>
          titre="Import en masse de souscripteurs"
          onClose={() => setOuvert(null)}
          onImported={() => undefined}
          telechargerModele={telechargerModeleImportClients}
          apercu={apercuImportClients}
          confirmer={confirmerImportClients}
          colonnes={[
            { key: "nom", label: "Nom" },
            { key: "type", label: "Type" },
            { key: "ville", label: "Ville" },
            { key: "tel", label: "Téléphone" },
            { key: "email", label: "E-mail" },
          ]}
        />
      )}

      {ouvert === "contrats" && (
        <ImportEnMasseModal<ImportContratRow>
          titre="Import en masse de contrats"
          onClose={() => setOuvert(null)}
          onImported={() => undefined}
          telechargerModele={telechargerModeleImportContrats}
          apercu={apercuImportContrats}
          confirmer={confirmerImportContrats}
          colonnes={[
            { key: "souscripteur", label: "Souscripteur" },
            { key: "compagnie", label: "Compagnie" },
            { key: "branche", label: "Branche" },
            { key: "dateDebut", label: "Effet" },
            { key: "dateFin", label: "Échéance" },
            { key: "prime", label: "Prime" },
            { key: "numeroPolice", label: "N° Police" },
            { key: "agence", label: "Agence" },
          ]}
        />
      )}

      {ouvert === "assures" && (
        <ChoixContratPuis titre="Import en masse d'assurés et ayants droit" onClose={() => setOuvert(null)}>
          {(contrat) => (
            <ImportEnMasseModal<ImportAssureRow>
              titre={`Import en masse d'assurés — ${numeroPolice(contrat)} (${contrat.client})`}
              onClose={() => setOuvert(null)}
              onImported={() => undefined}
              telechargerModele={telechargerModeleImportAssures}
              apercu={apercuImportAssures}
              // Synchronise automatiquement la file d'attente juste après
              // (2026-08 — voir demande utilisateur : "l'application devra
              // systématiquement synchroniser [et] charger les factures
              // sur les bons contrats") — cette population vient d'entrer,
              // silencieux si rien n'attendait ces matricules.
              confirmer={async (rows) => {
                const res = await confirmerImportAssures(contrat.id, rows);
                if (res.crees > 0) synchroniser(true);
                rafraichirEnAttenteTransfert();
                return res;
              }}
              colonnes={[
                { key: "matricule", label: "Matricule" },
                { key: "nom", label: "Nom" },
                { key: "prenom", label: "Prénom" },
                { key: "typeAssure", label: "Type" },
                { key: "dateNaissance", label: "Naissance" },
                { key: "sexe", label: "Sexe" },
                { key: "statut", label: "Statut" },
              ]}
            />
          )}
        </ChoixContratPuis>
      )}

      {ouvert === "factures" && (
        <ChoixContratPuis titre="Import en masse de factures" onClose={() => setOuvert(null)}>
          {(contrat) => (
            <ImportEnMasseModal<ImportFactureRow>
              titre={`Import en masse de factures — ${numeroPolice(contrat)} (${contrat.client})`}
              onClose={() => setOuvert(null)}
              onImported={() => undefined}
              telechargerModele={telechargerModeleImportFactures}
              apercu={(file) => apercuImportFactures(contrat.id, file)}
              confirmer={(rows) => confirmerImportFactures(contrat.id, rows)}
              colonnes={[
                { key: "matricule", label: "Matricule" },
                { key: "nom", label: "Nom" },
                { key: "prestataire", label: "Prestataire" },
                { key: "referenceFacture", label: "Réf. facture" },
                { key: "typePrestation", label: "Type" },
                { key: "acteMedical", label: "Acte" },
                { key: "datePrestation", label: "Date" },
                { key: "montant", label: "Montant" },
                { key: "statut", label: "Statut" },
              ]}
            />
          )}
        </ChoixContratPuis>
      )}

      {ouvert === "facturesGlobal" && (
        <ImportFacturesGlobalModal onClose={() => setOuvert(null)} onImporte={() => rafraichirEnAttente()} />
      )}

      {ouvert === "reglements" && (
        <ImportEnMasseModal<ImportReglementRow>
          titre="Import en masse de règlements"
          onClose={() => setOuvert(null)}
          onImported={() => undefined}
          telechargerModele={telechargerModeleImportReglements}
          apercu={apercuImportReglements}
          confirmer={confirmerImportReglements}
          colonnes={[
            { key: "prestataire", label: "Prestataire" },
            { key: "periode", label: "Période" },
            { key: "montantTotal", label: "Montant total" },
            { key: "statut", label: "Statut" },
            { key: "dateReception", label: "Réception" },
            { key: "datePaiement", label: "Paiement" },
          ]}
        />
      )}

      {ouvert === "accordsPrealables" && (
        <ChoixContratPuis titre="Import en masse de prises en charge" onClose={() => setOuvert(null)}>
          {(contrat) => (
            <ImportEnMasseModal<ImportAccordPrealableRow>
              titre={`Import en masse de prises en charge — ${numeroPolice(contrat)} (${contrat.client})`}
              onClose={() => setOuvert(null)}
              onImported={() => undefined}
              telechargerModele={telechargerModeleImportAccordsPrealables}
              apercu={(file) => apercuImportAccordsPrealables(contrat.id, file)}
              confirmer={(rows) => confirmerImportAccordsPrealables(contrat.id, rows)}
              colonnes={[
                { key: "matricule", label: "Matricule" },
                { key: "nom", label: "Nom" },
                { key: "type", label: "Type" },
                { key: "dateDemande", label: "Demande" },
                { key: "prestataire", label: "Prestataire" },
                { key: "decision", label: "Décision" },
                { key: "montantAutorise", label: "Montant autorisé" },
              ]}
            />
          )}
        </ChoixContratPuis>
      )}

      {ouvert === "photos" && <ImportPhotosModal onClose={() => setOuvert(null)} />}
    </div>
  );
}

// Choix préalable d'un contrat (2026-08 — voir demande utilisateur : "rendre
// l'import des factures et des prises en charge possible pour un contrat...
// que les données match avec la population du contrat") — partagé par
// Assurés, Factures et Prises en charge : une population/facture/prise en
// charge appartient TOUJOURS à un contrat précis, le choix se fait donc
// AVANT de pouvoir télécharger le modèle et importer, plutôt que dans le
// fichier lui-même (éviter qu'une simple faute de frappe sur l'identifiant
// du contrat disperse des données vers le mauvais contrat).
function ChoixContratPuis({ titre, onClose, children }: { titre: string; onClose: () => void; children: (contrat: Contrat) => React.ReactNode }) {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contrat, setContrat] = useState<Contrat | null>(null);

  useEffect(() => { getContrats().then(setContrats).catch(() => undefined); }, []);

  if (!contrat) {
    return (
      <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-foreground">{titre}</h3>
            <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">✕</button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[12px] text-muted-foreground">Choisissez d'abord le contrat concerné — le modèle se génère avec sa population, et les données importées y seront rattachées.</p>
            <Combobox
              options={contrats}
              value={null}
              onChange={(c) => c && setContrat(c)}
              getLabel={(c) => `${numeroPolice(c)} — ${c.client}`}
              getId={(c) => c.id}
            />
          </div>
          <div className="px-5 py-4 border-t border-border flex justify-end">
            <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(contrat)}</>;
}

// Import global de factures "tous contrats confondus" (2026-08) — voir
// demande utilisateur : "il faut aussi une option de fichier d'import de
// tous les contrats confondus... juste le numéro matricule... les
// matricules trouvés remontent, les autres en attente... gérer de façon
// optimum plus de 50000 lignes en une fois." PAS d'aperçu ligne à ligne
// (voir ImportService.importerFacturesGlobal — un tableau de 50 000
// lignes gèlerait le navigateur) : upload direct, résultat en résumé,
// même patron que Photos ci-dessous. Les rejets sont plafonnés à
// l'affichage (jamais des milliers de lignes rendues d'un coup).
const PLAFOND_REJETS_AFFICHES = 200;
function ImportFacturesGlobalModal({ onClose, onImporte }: { onClose: () => void; onImporte: () => void }) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<ResultatImportFacturesGlobal | null>(null);

  const handleImporter = async () => {
    if (!fichier) return;
    setEnvoi(true);
    try {
      const res = await importerFacturesGlobal(fichier);
      setResultat(res);
      onImporte();
      if (res.crees > 0 || res.enAttente > 0) {
        toast.success(`${res.crees} facture(s) créée(s)${res.enAttente > 0 ? `, ${res.enAttente} mise(s) en attente` : ""}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Globe2 className="w-4 h-4 text-primary" />Import de factures — tous contrats confondus</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Chaque ligne n'a besoin que du <span className="font-semibold text-foreground">matricule</span> de l'assuré — recherché dans la population de <span className="font-semibold text-foreground">tous les contrats</span>. Une ligne dont le matricule ne correspond encore à aucune population chargée n'est jamais perdue : elle est mise en attente, puis synchronisée automatiquement dès que sa population arrive.
            </p>
            <Btn variant="secondary" onClick={() => telechargerModeleImportFacturesGlobal()}><UploadCloud className="w-4 h-4" />Télécharger le modèle .xlsx</Btn>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-[13px] font-semibold text-foreground mb-2">Charger le fichier rempli</p>
            <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 cursor-pointer">
              <UploadCloud className="w-4 h-4" />{fichier ? fichier.name : "Choisir un fichier .xlsx"}
              <input type="file" className="hidden" accept=".xlsx" onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setResultat(null); }} />
            </label>
          </div>

          {fichier && !resultat && (
            <Btn variant="primary" disabled={envoi} onClick={handleImporter}>
              <UploadCloud className="w-4 h-4" />{envoi ? "Import en cours — peut prendre plusieurs minutes sur un gros fichier…" : "Importer"}
            </Btn>
          )}

          {resultat && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />
                {resultat.total} ligne(s) lue(s) — {resultat.crees} créée(s), {resultat.enAttente} mise(s) en attente, {resultat.rejets.length} rejetée(s).
              </p>
              {resultat.enAttente > 0 && (
                <p className="text-[11.5px] text-amber-700 dark:text-amber-300">Les lignes en attente seront synchronisées automatiquement dès que leur population sera chargée (ou via le bouton "Synchroniser maintenant" sur cet écran).</p>
              )}
              {resultat.rejets.length > 0 && (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {resultat.rejets.slice(0, PLAFOND_REJETS_AFFICHES).map((r, i) => (
                    <p key={i} className="text-[11.5px] text-red-700 dark:text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />Ligne {r.ligne} — {r.motif}
                    </p>
                  ))}
                  {resultat.rejets.length > PLAFOND_REJETS_AFFICHES && (
                    <p className="text-[11.5px] text-muted-foreground italic">… et {resultat.rejets.length - PLAFOND_REJETS_AFFICHES} rejet(s) supplémentaire(s), non affiché(s).</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end">
          <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}

// Import de photos en masse (2026-08) — voir demande utilisateur : "importer
// même les photo dans un dossier en une fois (mais il faudra juste que la
// photo soit renommer par les matricule de bénéficiaire de la photo)".
// DEUX sélecteurs (2026-09) — voir demandes utilisateur successives : "que
// l'on puisse sélectionner précisément la ou les fichiers images à
// charger" PUIS "si on sélectionne un dossier, l'application doit pouvoir
// [lire] tout fichier image dans le dossier général ainsi que dans tous
// les sous-dossiers" — les deux besoins coexistent, d'où deux boutons :
// 1. `<input multiple>` simple — boîte de dialogue standard de l'OS,
//    sélection précise d'un ou plusieurs fichiers à la main.
// 2. `<input multiple webkitdirectory>` — sélection d'un dossier entier ;
//    le navigateur renvoie NATIVEMENT tous les fichiers de l'arborescence
//    complète, sous-dossiers compris (récursif, sans code supplémentaire).
// Dans les deux cas, aucun filtre `accept` (tout format visible et
// sélectionnable) ; chaque fichier part sous son propre nom, apparié côté
// serveur par ce nom (sans extension) = matricule.
// Envoi PAR LOTS (2026-09) — voir "Failed to fetch" sur 322 photos d'un
// coup : un unique gros envoi multipart (potentiellement plusieurs
// centaines de Mo) est fragile — au moindre à-coup réseau, la connexion
// casse en cours de flux et le navigateur ne reçoit qu'une erreur réseau
// générique, pas une réponse propre. Fractionner en lots plus petits
// réduit le risque par envoi et permet de garder ce qui a déjà réussi même
// si un lot plus loin échoue, plutôt que tout perdre d'un bloc.
const TAILLE_LOT = 40;

function ImportPhotosModal({ onClose }: { onClose: () => void }) {
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);
  const [resultat, setResultat] = useState<{ importees: number; rejets: { fichier: string; motif: string }[] } | null>(null);

  const handleDossier = (files: FileList | null) => {
    if (!files) return;
    setFichiers(Array.from(files));
    setResultat(null);
  };

  const handleImporter = async () => {
    if (fichiers.length === 0) return;
    setEnvoi(true);
    setProgression({ fait: 0, total: fichiers.length });
    const cumul: { importees: number; rejets: { fichier: string; motif: string }[] } = { importees: 0, rejets: [] };
    try {
      for (let i = 0; i < fichiers.length; i += TAILLE_LOT) {
        const lot = fichiers.slice(i, i + TAILLE_LOT);
        try {
          const res = await importerPhotosEnMasse(lot);
          cumul.importees += res.importees;
          cumul.rejets.push(...res.rejets);
        } catch (err) {
          // Un lot en échec n'annule pas les suivants — chaque photo déjà
          // importée avec succès dans un lot précédent reste acquise.
          for (const f of lot) cumul.rejets.push({ fichier: f.name, motif: err instanceof Error ? err.message : "Envoi impossible (lot en échec)." });
        }
        setProgression({ fait: Math.min(i + TAILLE_LOT, fichiers.length), total: fichiers.length });
      }
      setResultat(cumul);
      if (cumul.importees > 0) toast.success(`${cumul.importees} photo(s) importée(s).`);
      else if (cumul.rejets.length > 0) toast.error("Aucune photo importée — voir le détail ci-dessous.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setEnvoi(false);
      setProgression(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">Import en masse de photos</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-[13px] font-semibold text-foreground mb-1">Sélectionner les photos</p>
            <p className="text-[12px] text-muted-foreground mb-3">
              Chaque photo doit être nommée avec le <span className="font-semibold text-foreground">matricule exact</span> du bénéficiaire (ex. « SEEG-GA-00234.jpg »), sans autre texte dans le nom du fichier.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 cursor-pointer">
                <FolderUp className="w-4 h-4" />{fichiers.length > 0 ? `${fichiers.length} fichier(s) sélectionné(s)` : "Choisir des photos"}
                {/* Sélecteur de FICHIERS multiples (2026-09, correctif réel) —
                    voir demande utilisateur : "le sélecteur ne montre pas les
                    fichiers photo qui sont dans un dossier afin que l'on
                    puisse sélectionner précisément la ou les fichiers images à
                    charger" : le mode "dossier entier" (`webkitdirectory`) ne
                    permet PAS de choisir des fichiers un par un dans certains
                    navigateurs. Un simple `<input multiple>` SANS
                    `webkitdirectory` ouvre la boîte de dialogue standard de
                    l'OS : on y navigue jusqu'au dossier, on VOIT tous les
                    fichiers qu'il contient (aucun `accept` = aucun filtre,
                    tout format visible), et on choisit précisément lesquels
                    importer (Ctrl/Maj + clic pour plusieurs à la fois). */}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(e) => handleDossier(e.target.files)}
                />
              </label>
              <span className="text-[11px] text-muted-foreground">ou</span>
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 cursor-pointer">
                <FolderTree className="w-4 h-4" />Importer tout un dossier
                {/* Dossier entier, sous-dossiers compris (2026-09) — voir
                    demande utilisateur : "si on sélectionne un dossier,
                    l'application doit pouvoir [lire] tout fichier image dans
                    le dossier général ainsi que dans tous les sous-dossiers".
                    `webkitdirectory` renvoie NATIVEMENT tous les fichiers de
                    l'arborescence complète (récursif, aucun code
                    supplémentaire nécessaire) — posé via `ref`+
                    `setAttribute`, PAS en prop JSX (voir plus haut :
                    `{...{webkitdirectory:"true"}}` s'est montré peu fiable),
                    même technique éprouvée que `ImportDiffereModal.tsx`.
                    Complète le sélecteur multi-fichiers ci-dessus plutôt que
                    de le remplacer : l'un pour choisir précisément, l'autre
                    pour tout prendre d'un coup. */}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  ref={(el) => { if (el) { el.setAttribute("webkitdirectory", "true"); el.setAttribute("directory", "true"); } }}
                  onChange={(e) => handleDossier(e.target.files)}
                />
              </label>
            </div>
          </div>

          {fichiers.length > 0 && (
            <div className="space-y-2">
              <Btn variant="primary" disabled={envoi} onClick={handleImporter}>
                <UploadCloud className="w-4 h-4" />
                {envoi && progression ? `Import en cours… ${progression.fait}/${progression.total}` : `Importer ${fichiers.length} photo(s)`}
              </Btn>
              {envoi && progression && (
                <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(progression.fait / progression.total) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {resultat && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-[13px] font-semibold text-foreground flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />{resultat.importees} photo(s) importée(s) avec succès.</p>
              {resultat.rejets.length > 0 && (
                <div className="space-y-1">
                  {resultat.rejets.map((r, i) => (
                    <p key={i} className="text-[11.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /><span className="font-medium">{r.fichier}</span> — {r.motif}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end">
          <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}

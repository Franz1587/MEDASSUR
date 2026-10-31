import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Upload, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import {
  apercuImportLibre, confirmerImportLibre, confirmerPopulation, confirmerActesMedicaux,
  estPopulation, estActesMedicaux,
  type LigneApercu, type LignePopulation, type LigneActeMedical,
  type ResultatApercu, type ResultatPopulation, type ResultatActesMedicaux,
  type ResultatImportLibre, type TypeImportLibre,
} from "@/services/import-libre.service";

// Import libre Ariana (2026-10, étendu 2026-10-31) — PDF, XLS (BIFF8), XLSX,
// CSV, TXT — détection automatique du type (factures / population / actes-médicaux).

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

// ── Badges ────────────────────────────────────────────────────────────────

function BadgeLigneFact({ l }: { l: LigneApercu }) {
  if (l.miseAJour) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">à corriger</span>;
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">ok</span>;
}

function BadgeLignePop({ l }: { l: LignePopulation }) {
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">inchangé</span>;
  if (l.changementContrat) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">chgt contrat</span>;
  if (l.changementStatut) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">chgt statut</span>;
  if (!l.assureId) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">nouveau</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
}

function BadgeLigneActe({ l }: { l: LigneActeMedical }) {
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">{l.erreur}</span>;
  if (l.estNouvel) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">nouveau</span>;
  if (l.changementPrix) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">maj prix</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">inchangé</span>;
}

// ── Labels de type ────────────────────────────────────────────────────────

const LABELS_TYPE: Record<string, string> = {
  auto: "Détection automatique",
  factures: "Factures",
  population: "Population (assurés)",
  "actes-medicaux": "Actes médicaux",
  souscripteurs: "Souscripteurs",
  contrats: "Contrats",
  assures: "Assurés",
  "prises-en-charge": "Prises en charge",
  reglements: "Règlements",
};

// ── Tableaux d'aperçu ─────────────────────────────────────────────────────

function TableauFactures({ lignes }: { lignes: LigneApercu[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Réf. facture</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Bénéficiaire</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Désignation</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Prestataire</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Date</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Part fin.</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.miseAJour ? "bg-blue-50/50" : l.doublon ? "bg-amber-50/50" : l.erreur ? "bg-red-50/50" : "hover:bg-muted/30"}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.referenceFacture || "—"}</td>
              <td className="px-2.5 py-1.5">
                <p className="font-medium truncate max-w-[110px] text-foreground">{l.beneficiaire || "—"}</p>
                <p className="text-muted-foreground text-[10px]">{l.matricule}</p>
              </td>
              <td className="px-2.5 py-1.5 truncate max-w-[130px] text-foreground">{l.designation || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[130px] text-foreground">{l.prestataireNom || "—"}</td>
              <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{l.datePrestation || "—"}</td>
              <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-foreground">
                {l.partFinanceur > 0 ? l.partFinanceur.toLocaleString("fr-FR") : "—"}
              </td>
              <td className="px-2.5 py-1.5"><BadgeLigneFact l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauPopulation({ lignes }: { lignes: LignePopulation[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Matricule</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Nom Prénom</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Type</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Statut actuel</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Statut fichier</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.erreur ? "bg-red-50/50" : l.doublon ? "bg-amber-50/50" : l.changementStatut || l.changementContrat ? "bg-blue-50/50" : !l.assureId ? "bg-emerald-50/50" : ""}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.matricule || "—"}</td>
              <td className="px-2.5 py-1.5">
                <p className="font-medium truncate max-w-[130px] text-foreground">{[l.nom, l.prenom].filter(Boolean).join(" ") || "—"}</p>
                {l.dateNaissance && <p className="text-muted-foreground text-[10px]">{l.dateNaissance}</p>}
              </td>
              <td className="px-2.5 py-1.5 text-foreground">{l.typeAssure || "—"}</td>
              <td className="px-2.5 py-1.5 text-foreground">{l.statutActuel || <span className="text-muted-foreground italic">—</span>}</td>
              <td className="px-2.5 py-1.5">
                <span className={l.statutFichier?.toLowerCase().includes("termin") ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                  {l.statutFichier || "—"}
                </span>
              </td>
              <td className="px-2.5 py-1.5"><BadgeLignePop l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauActes({ lignes }: { lignes: LigneActeMedical[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Code</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Libellé</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Famille</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Prix actuel</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Nouveau prix</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.erreur ? "bg-red-50/50" : l.estNouvel ? "bg-emerald-50/50" : l.changementPrix ? "bg-blue-50/50" : ""}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">{l.code || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[200px] text-foreground font-medium">{l.libelle || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[120px] text-muted-foreground">{l.famille || "—"}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                {l.prixActuel !== null ? l.prixActuel.toLocaleString("fr-FR") : "—"}
              </td>
              <td className={`px-2.5 py-1.5 text-right tabular-nums font-medium ${l.changementPrix ? "text-blue-600" : "text-foreground"}`}>
                {l.prixDefaut > 0 ? l.prixDefaut.toLocaleString("fr-FR") : "—"}
              </td>
              <td className="px-2.5 py-1.5"><BadgeLigneActe l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Aperçu générique (Ariana résumé) ─────────────────────────────────────

function ApercuGenerique({ r }: { r: ResultatApercu }) {
  return (
    <div className="space-y-3">
      {r.apercu && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-[13px] text-foreground flex gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            {r.apercu}
          </p>
        </div>
      )}
      {r.colonnesDetectees && r.colonnesDetectees.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-secondary/30">
          <p className="text-[11px] text-muted-foreground font-medium mb-1">Colonnes détectées</p>
          <div className="flex flex-wrap gap-1">
            {r.colonnesDetectees.map((c) => (
              <span key={c} className="px-1.5 py-0.5 bg-secondary text-[10px] rounded font-mono">{c}</span>
            ))}
          </div>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">
        {r.totalLignes} ligne(s) détectée(s) — Pour importer ces données, utilisez l'import dédié dans le module correspondant.
      </p>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

interface EtatFichier {
  nom: string;
  resultat: ResultatImportLibre;
}

export function ImportLibreModal({ ouvert, onFermer }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<"upload" | "analyse" | "apercu" | "confirmation">("upload");
  const [fichiers, setFichiers] = useState<EtatFichier[]>([]);
  const [fichierEnCours, setFichierEnCours] = useState("");
  const [modeCorrection, setModeCorrection] = useState(false);
  const [typeImport, setTypeImport] = useState<TypeImportLibre>("auto");

  if (!ouvert) return null;

  const reset = () => { setEtape("upload"); setFichiers([]); setFichierEnCours(""); setTypeImport("auto"); };
  const fermer = () => { reset(); onFermer(); };

  // Résumé selon le type détecté
  const totalAction = fichiers.reduce((s, f) => {
    const r = f.resultat;
    if (estPopulation(r)) return s + r.totalNouveaux + r.totalChangementsStatut + r.totalChangementsContrat;
    if (estActesMedicaux(r)) return s + r.totalNouveaux + r.totalMisesAJour;
    return s + (r as ResultatApercu).totalResolues + (r as ResultatApercu).totalMisesAJour;
  }, 0);

  const typeDetecte: TypeImportLibre | null = fichiers.length > 0
    ? ((fichiers[0].resultat as { typeDetecte?: TypeImportLibre }).typeDetecte ?? null)
    : null;

  const handleFichiers = async (liste: FileList) => {
    setEtape("analyse");
    const resultats: EtatFichier[] = [...fichiers];
    for (const fichier of Array.from(liste)) {
      setFichierEnCours(fichier.name);
      try {
        const res = await apercuImportLibre(fichier, modeCorrection, typeImport);
        resultats.push({ nom: fichier.name, resultat: res });
      } catch (err) {
        toast.error(`${fichier.name} : ${err instanceof Error ? err.message : "Analyse impossible."}`);
      }
    }
    setFichiers(resultats);
    setEtape(resultats.length > 0 ? "apercu" : "upload");
    setFichierEnCours("");
  };

  const handleConfirmer = async () => {
    if (totalAction === 0) { toast.warning("Aucune ligne éligible à l'import."); return; }
    setEtape("confirmation");
    try {
      let msgs: string[] = [];

      for (const f of fichiers) {
        const r = f.resultat;
        if (estPopulation(r)) {
          const lignesAction = r.lignes.filter((l) => !l.erreur && !l.doublon);
          if (lignesAction.length > 0) {
            const res = await confirmerPopulation(lignesAction);
            if (res.crees) msgs.push(`${res.crees} assuré(s) créé(s)`);
            if (res.miseAJour) msgs.push(`${res.miseAJour} mis à jour`);
            if (res.ignorees) msgs.push(`${res.ignorees} ignoré(s)`);
          }
        } else if (estActesMedicaux(r)) {
          const lignesAction = r.lignes.filter((l) => !l.erreur && (l.estNouvel || l.changementPrix));
          if (lignesAction.length > 0) {
            const res = await confirmerActesMedicaux(lignesAction);
            if (res.crees) msgs.push(`${res.crees} acte(s) créé(s)`);
            if (res.miseAJour) msgs.push(`${res.miseAJour} prix mis à jour`);
            if (res.ignorees) msgs.push(`${res.ignorees} ignoré(s)`);
          }
        } else {
          const ra = r as ResultatApercu;
          const lignesValides = ra.lignes.filter((l) => l.assureId && !l.doublon && !l.erreur);
          const lignesMaj = modeCorrection ? ra.lignes.filter((l) => l.miseAJour) : [];
          if (lignesValides.length > 0 || lignesMaj.length > 0) {
            const res = await confirmerImportLibre([...lignesValides, ...lignesMaj], modeCorrection, "factures");
            if (res.importees) msgs.push(`${res.importees} ligne(s) importée(s)`);
            if (res.corrigees) msgs.push(`${res.corrigees} montant(s) corrigé(s)`);
            if (res.ignorees) msgs.push(`${res.ignorees} ignorée(s)`);
          }
        }
      }

      toast.success(msgs.length > 0 ? msgs.join(", ") + "." : "Import terminé.");
      fermer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
      setEtape("apercu");
    }
  };

  const labelTypeDetecte = typeDetecte ? LABELS_TYPE[typeDetecte] : null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Import libre — ARIANA
            </h3>
            {etape === "apercu" && fichiers.length > 0 && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                <span className="font-medium">{fichiers.length} fichier(s)</span>
                {labelTypeDetecte && <> · <span className="text-primary font-medium">{labelTypeDetecte}</span></>}
                {" — "}
                <span className="text-emerald-600">{totalAction} action(s)</span>
              </p>
            )}
          </div>
          <button type="button" onClick={fermer} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Zone upload */}
          {etape === "upload" && (
            <div className="space-y-4">
              {/* Sélecteur de type */}
              <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
                <p className="text-[12.5px] font-medium text-foreground">Type de données</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    ["auto", "Automatique", "Ariana détecte le type"],
                    ["factures", "Factures", "Liste de factures détaillées"],
                    ["population", "Population", "Assurés / participants"],
                    ["actes-medicaux", "Actes médicaux", "Catalogue de tarifs"],
                    ["souscripteurs", "Souscripteurs", "via Ariana"],
                    ["contrats", "Contrats", "via Ariana"],
                    ["prises-en-charge", "Prises en charge", "via Ariana"],
                    ["reglements", "Règlements", "via Ariana"],
                  ] as [TypeImportLibre, string, string][]).map(([val, label, desc]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setTypeImport(val)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors ${typeImport === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      <span className={`text-[12px] font-medium block ${typeImport === val ? "text-primary" : "text-foreground"}`}>{label}</span>
                      <span className="text-[10px] text-muted-foreground">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode correction (factures seulement) */}
              {typeImport === "factures" && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input type="checkbox" checked={modeCorrection} onChange={(e) => setModeCorrection(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                      Mode correction
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Corrige les montants à 0 sur les lignes déjà importées sans créer de doublons.</p>
                  </div>
                </label>
              )}

              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFichiers(e.dataTransfer.files); }}
              >
                <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium text-foreground">Glisser-déposer un ou plusieurs fichiers, ou cliquer pour choisir</p>
                <p className="text-[13px] text-muted-foreground mt-1">PDF, Excel (.xlsx / .xls), CSV, TXT — max 50 Mo par fichier</p>
                {typeImport === "auto" && (
                  <p className="text-[11px] text-primary/80 mt-2 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Ariana détecte automatiquement le type de données
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFichiers(e.target.files); }}
                />
              </div>
            </div>
          )}

          {/* Analyse en cours */}
          {etape === "analyse" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">ARIANA analyse <span className="text-primary">{fichierEnCours}</span>…</p>
              {fichiers.length > 0 && <p className="text-[13px] text-muted-foreground">{fichiers.length} fichier(s) déjà analysé(s)</p>}
              <p className="text-[13px] text-muted-foreground">Détection du type · Extraction des données · Résolution des doublons</p>
            </div>
          )}

          {/* Confirmation en cours */}
          {etape === "confirmation" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">Import en cours…</p>
            </div>
          )}

          {/* Aperçu */}
          {etape === "apercu" && fichiers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
                {fichiers.map((f) => (
                  <span key={f.nom} className="font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{f.nom}</span>
                ))}
                <button type="button" onClick={reset} className="text-[11px] underline hover:text-foreground ml-1">Changer les fichiers</button>
                <button type="button" onClick={() => inputRef.current?.click()} className="text-[11px] underline hover:text-foreground text-primary">
                  + Ajouter d'autres fichiers
                </button>
                <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt" className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFichiers(e.target.files); }} />
              </div>

              {fichiers.map((f, fi) => {
                const r = f.resultat;
                const titre = LABELS_TYPE[((r as { typeDetecte?: string }).typeDetecte) ?? ""] ?? "Document";
                return (
                  <div key={fi} className="space-y-2">
                    {fichiers.length > 1 && (
                      <p className="text-[12px] font-medium text-foreground">
                        {f.nom} — <span className="text-primary">{titre}</span>
                      </p>
                    )}
                    {estPopulation(r) ? (
                      r.lignes.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span className="text-[13px]">Aucune ligne extraite de la population.</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-3 text-[12px]">
                            {r.police && <span className="text-muted-foreground">Police : <span className="font-medium text-foreground">{r.police}</span></span>}
                            {r.organisme && <span className="text-muted-foreground">Organisme : <span className="font-medium text-foreground">{r.organisme}</span></span>}
                            <span className="text-emerald-600 font-medium">{r.totalNouveaux} nouveaux</span>
                            {r.totalChangementsStatut > 0 && <span className="text-blue-600 font-medium">{r.totalChangementsStatut} chgt statut</span>}
                            {r.totalChangementsContrat > 0 && <span className="text-purple-600 font-medium">{r.totalChangementsContrat} chgt contrat</span>}
                            {r.totalDoublons > 0 && <span className="text-amber-600">{r.totalDoublons} inchangés</span>}
                            {r.totalErreurs > 0 && <span className="text-red-600">{r.totalErreurs} erreurs</span>}
                          </div>
                          <TableauPopulation lignes={r.lignes} />
                        </>
                      )
                    ) : estActesMedicaux(r) ? (
                      r.lignes.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span className="text-[13px]">Aucun acte extrait du catalogue.</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-3 text-[12px]">
                            <span className="text-emerald-600 font-medium">{r.totalNouveaux} nouveaux actes</span>
                            {r.totalMisesAJour > 0 && <span className="text-blue-600 font-medium">{r.totalMisesAJour} prix à mettre à jour</span>}
                            {r.totalDoublons > 0 && <span className="text-amber-600">{r.totalDoublons} inchangés</span>}
                            {r.totalErreurs > 0 && <span className="text-red-600">{r.totalErreurs} erreurs</span>}
                          </div>
                          <TableauActes lignes={r.lignes} />
                        </>
                      )
                    ) : (r as ResultatApercu).lignes.length === 0 ? (
                      <ApercuGenerique r={r as ResultatApercu} />
                    ) : (
                      <TableauFactures lignes={(r as ResultatApercu).lignes} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          {etape === "apercu" && totalAction > 0 ? (
            <>
              <div className="flex items-center gap-1.5 text-[13px] text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                {totalAction} action(s) à appliquer
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={fermer}>Annuler</Btn>
                <Btn variant="primary" onClick={handleConfirmer}>Confirmer l'import</Btn>
              </div>
            </>
          ) : (
            <div className="ml-auto">
              <Btn variant="secondary" onClick={fermer}>Fermer</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

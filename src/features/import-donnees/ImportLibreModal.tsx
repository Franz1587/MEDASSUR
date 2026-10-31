import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { apercuImportLibre, confirmerImportLibre, type LigneApercu, type ResultatApercu, type TypeImportLibre } from "@/services/import-libre.service";

// Import libre de factures (2026-10) — voir demande utilisateur : "je voudrais
// que tu crées un import libre pour les factures. Ce type d'import sera aidé
// par Ariana pour lire des milliers de documents ou fichier de type excel,
// csv, txt et même PDF."

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

function BadgeLigne({ l }: { l: LigneApercu }) {
  if (l.miseAJour) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">à corriger</span>;
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">ok</span>;
}

interface EtatFichier {
  nom: string;
  apercu: ResultatApercu;
}

export function ImportLibreModal({ ouvert, onFermer }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<"upload" | "analyse" | "apercu" | "confirmation">("upload");
  const [fichiers, setFichiers] = useState<EtatFichier[]>([]);
  const [fichierEnCours, setFichierEnCours] = useState("");
  const [modeCorrection, setModeCorrection] = useState(false);
  const [typeImport, setTypeImport] = useState<TypeImportLibre>("factures");

  if (!ouvert) return null;

  const reset = () => { setEtape("upload"); setFichiers([]); setFichierEnCours(""); setTypeImport("factures"); };
  const fermer = () => { reset(); onFermer(); };

  // Résumé cumulé de tous les fichiers analysés
  const toutesLignes = fichiers.flatMap((f) => f.apercu.lignes);
  const totalResolues = fichiers.reduce((s, f) => s + f.apercu.totalResolues, 0);
  const totalMisesAJour = fichiers.reduce((s, f) => s + f.apercu.totalMisesAJour, 0);
  const totalDoublons = fichiers.reduce((s, f) => s + f.apercu.totalDoublons, 0);
  const totalErreurs = fichiers.reduce((s, f) => s + f.apercu.totalErreurs, 0);

  const handleFichiers = async (liste: FileList) => {
    setEtape("analyse");
    const resultats: EtatFichier[] = [...fichiers];
    for (const fichier of Array.from(liste)) {
      setFichierEnCours(fichier.name);
      try {
        const res = await apercuImportLibre(fichier, modeCorrection, typeImport);
        resultats.push({ nom: fichier.name, apercu: res });
      } catch (err) {
        toast.error(`${fichier.name} : ${err instanceof Error ? err.message : "Analyse impossible."}`);
      }
    }
    setFichiers(resultats);
    setEtape(resultats.length > 0 ? "apercu" : "upload");
    setFichierEnCours("");
  };

  const handleConfirmer = async () => {
    const lignesAImporter = toutesLignes.filter((l) => l.assureId && !l.doublon && !l.erreur);
    const lignesMaj = modeCorrection ? toutesLignes.filter((l) => l.miseAJour) : [];
    if (lignesAImporter.length === 0 && lignesMaj.length === 0) {
      toast.warning("Aucune ligne éligible à l'import."); return;
    }
    setEtape("confirmation");
    try {
      const res = await confirmerImportLibre([...lignesAImporter, ...lignesMaj], modeCorrection, typeImport);
      const msgs = [];
      if (res.importees > 0) msgs.push(`${res.importees} ligne(s) importée(s)`);
      if (res.corrigees > 0) msgs.push(`${res.corrigees} montant(s) corrigé(s)`);
      if (res.ignorees > 0) msgs.push(`${res.ignorees} ignorée(s)`);
      toast.success(msgs.join(", ") + ".");
      fermer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
      setEtape("apercu");
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Import libre — ARIANA</h3>
            {fichiers.length > 0 && etape === "apercu" && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                <span className="font-medium">{fichiers.length} fichier(s)</span>{" — "}
                <span className="text-emerald-600">{totalResolues} à importer</span>
                {totalMisesAJour > 0 && <> · <span className="text-blue-600">{totalMisesAJour} à corriger</span></>}
                {totalDoublons > 0 && <> · <span className="text-amber-600">{totalDoublons} doublons</span></>}
                {totalErreurs > 0 && <> · <span className="text-red-600">{totalErreurs} erreurs</span></>}
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
                <p className="text-[12.5px] font-medium text-foreground">Type de données à importer</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    ["factures", "Factures"],
                    ["souscripteurs", "Souscripteurs"],
                    ["contrats", "Contrats"],
                    ["assures", "Assurés"],
                    ["prises-en-charge", "Prises en charge"],
                    ["reglements", "Règlements"],
                  ] as [TypeImportLibre, string][]).map(([val, label]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setTypeImport(val)}
                      className={`px-3 py-2 rounded-lg border text-[12px] transition-colors text-left ${typeImport === val ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                      {val !== "factures" && <span className="block text-[10px] text-muted-foreground font-normal">via Ariana (analyse)</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode correction */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={modeCorrection}
                  onChange={(e) => setModeCorrection(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                    Mode correction
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Corrige les montants à 0 sur les lignes déjà importées — sans créer de doublons. Utilise les valeurs du fichier pour mettre à jour les montants manquants.
                  </p>
                </div>
              </label>

              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFichiers(e.dataTransfer.files); }}
              >
                <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium text-foreground">Glisser-déposer un ou plusieurs fichiers, ou cliquer pour choisir</p>
                <p className="text-[13px] text-muted-foreground mt-1">PDF, Excel (.xlsx / .xls), CSV, TXT — max 50 Mo par fichier</p>
                <p className="text-[11px] text-muted-foreground/70 mt-2">Plusieurs fichiers acceptés — traitement séquentiel</p>
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
              {fichiers.length > 0 && (
                <p className="text-[13px] text-muted-foreground">{fichiers.length} fichier(s) déjà analysé(s)</p>
              )}
              <p className="text-[13px] text-muted-foreground">Résolution des assurés, prestataires et doublons en cours</p>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
                {fichiers.map((f) => (
                  <span key={f.nom} className="font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{f.nom}</span>
                ))}
                <button type="button" onClick={reset} className="text-[11px] underline hover:text-foreground ml-1">Changer les fichiers</button>
                {/* Ajouter d'autres fichiers */}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-[11px] underline hover:text-foreground text-primary"
                >
                  + Ajouter d'autres fichiers
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFichiers(e.target.files); setEtape("apercu"); }}
                />
              </div>

              {toutesLignes.length === 0 ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-[13px]">Aucune ligne extraite. Vérifiez que les fichiers sont au bon format.</span>
                </div>
              ) : (
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
                      {toutesLignes.map((l, i) => (
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
                          <td className="px-2.5 py-1.5"><BadgeLigne l={l} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          {etape === "apercu" && (totalResolues > 0 || (modeCorrection && totalMisesAJour > 0)) ? (
            <>
              <div className="flex items-center gap-3 text-[13px]">
                {totalResolues > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {totalResolues} ligne(s) prête(s)
                  </span>
                )}
                {modeCorrection && totalMisesAJour > 0 && (
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <RefreshCw className="w-4 h-4" />
                    {totalMisesAJour} montant(s) à corriger
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={fermer}>Annuler</Btn>
                <Btn variant="primary" onClick={handleConfirmer}>
                  {totalResolues > 0 && totalMisesAJour > 0
                    ? `Importer ${totalResolues} + corriger ${totalMisesAJour}`
                    : totalMisesAJour > 0
                    ? `Corriger ${totalMisesAJour} montant(s)`
                    : `Importer ${totalResolues} ligne(s)`}
                </Btn>
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

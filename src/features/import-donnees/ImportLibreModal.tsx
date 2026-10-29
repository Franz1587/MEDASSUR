import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { apercuImportLibre, confirmerImportLibre, type LigneApercu, type ResultatApercu } from "@/services/import-libre.service";

// Import libre de factures (2026-10) — voir demande utilisateur : "je voudrais
// que tu crées un import libre pour les factures. Ce type d'import sera aidé
// par Ariana pour lire des milliers de documents ou fichier de type excel,
// csv, txt et même PDF."

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

function BadgeLigne({ l }: { l: LigneApercu }) {
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">ok</span>;
}

export function ImportLibreModal({ ouvert, onFermer }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<"upload" | "analyse" | "apercu" | "confirmation">("upload");
  const [apercu, setApercu] = useState<ResultatApercu | null>(null);
  const [fichierNom, setFichierNom] = useState("");

  if (!ouvert) return null;

  const reset = () => { setEtape("upload"); setApercu(null); setFichierNom(""); };
  const fermer = () => { reset(); onFermer(); };

  const handleFichier = async (fichier: File) => {
    setFichierNom(fichier.name);
    setEtape("analyse");
    try {
      const res = await apercuImportLibre(fichier);
      setApercu(res);
      setEtape("apercu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse impossible.");
      setEtape("upload");
    }
  };

  const handleConfirmer = async () => {
    if (!apercu) return;
    const lignesAImporter = apercu.lignes.filter((l) => l.assureId && !l.doublon && !l.erreur);
    if (lignesAImporter.length === 0) { toast.warning("Aucune ligne éligible à l'import."); return; }
    setEtape("confirmation");
    try {
      const res = await confirmerImportLibre(lignesAImporter);
      toast.success(`${res.importees} ligne(s) importée(s)${res.ignorees > 0 ? `, ${res.ignorees} ignorée(s)` : ""}.`);
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
            <h3 className="text-[15px] font-semibold text-foreground">Import libre de factures — Ariana</h3>
            {apercu && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                <span className="font-medium">{apercu.organisme || apercu.contratRef}</span>
                {apercu.periode && <> · {apercu.periode}</>}
                {" — "}
                <span className="text-emerald-600">{apercu.totalResolues} à importer</span>
                {apercu.totalDoublons > 0 && <> · <span className="text-amber-600">{apercu.totalDoublons} doublons</span></>}
                {apercu.totalErreurs > 0 && <> · <span className="text-red-600">{apercu.totalErreurs} erreurs</span></>}
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
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFichier(f); }}
            >
              <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-foreground">Glisser-déposer un fichier ou cliquer pour choisir</p>
              <p className="text-[13px] text-muted-foreground mt-1">PDF, Excel (.xlsx / .xls), CSV, TXT — max 50 Mo</p>
              <p className="text-[11px] text-muted-foreground/70 mt-2">Format Eyassur "Liste des factures détaillées" recommandé</p>
              <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFichier(f); }} />
            </div>
          )}

          {/* Analyse en cours */}
          {etape === "analyse" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">Ariana analyse <span className="text-primary">{fichierNom}</span>…</p>
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
          {etape === "apercu" && apercu && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{fichierNom}</span>
                <button type="button" onClick={reset} className="text-[11px] underline hover:text-foreground">Changer de fichier</button>
              </div>
              {apercu.lignes.length === 0 ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-[13px]">Aucune ligne extraite. Vérifiez que le fichier est au bon format.</span>
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
                      {apercu.lignes.map((l, i) => (
                        <tr key={i} className={l.doublon ? "bg-amber-50/50" : l.erreur ? "bg-red-50/50" : "hover:bg-muted/30"}>
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
          {etape === "apercu" && apercu && apercu.totalResolues > 0 ? (
            <>
              <div className="flex items-center gap-1.5 text-[13px] text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>{apercu.totalResolues} ligne(s) prête(s) à importer</span>
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={fermer}>Annuler</Btn>
                <Btn variant="primary" onClick={handleConfirmer}>
                  Importer {apercu.totalResolues} ligne(s)
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

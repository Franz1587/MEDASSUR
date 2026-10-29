import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog open={ouvert} onOpenChange={(o) => !o && fermer()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Import libre de factures — Ariana</DialogTitle>
            <button onClick={fermer} className="rounded-full p-1 hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
          {apercu && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">{apercu.organisme || apercu.contratRef}</span>
              {apercu.periode && <> · {apercu.periode}</>}
              {" — "}
              <span className="text-emerald-600">{apercu.totalResolues} à importer</span>
              {apercu.totalDoublons > 0 && <> · <span className="text-amber-600">{apercu.totalDoublons} doublons</span></>}
              {apercu.totalErreurs > 0 && <> · <span className="text-red-600">{apercu.totalErreurs} erreurs</span></>}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
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
              <p className="text-sm text-muted-foreground mt-1">PDF, Excel (.xlsx / .xls), CSV, TXT — max 50 Mo</p>
              <p className="text-xs text-muted-foreground/70 mt-2">Format Eyassur "Liste des factures détaillées" recommandé</p>
              <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFichier(f); }} />
            </div>
          )}

          {/* Analyse en cours */}
          {etape === "analyse" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium">Ariana analyse <span className="text-primary">{fichierNom}</span>…</p>
              <p className="text-sm text-muted-foreground">Résolution des assurés, prestataires et doublons en cours</p>
            </div>
          )}

          {/* Confirmation en cours */}
          {etape === "confirmation" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium">Import en cours…</p>
            </div>
          )}

          {/* Aperçu */}
          {etape === "apercu" && apercu && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{fichierNom}</span>
                <button onClick={reset} className="text-xs underline hover:text-foreground">Changer de fichier</button>
              </div>
              {apercu.lignes.length === 0 ? (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">Aucune ligne extraite. Vérifiez que le fichier est au bon format.</span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Réf. facture</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Bénéficiaire</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Désignation</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Prestataire</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Part fin.</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {apercu.lignes.map((l, i) => (
                        <tr key={i} className={l.doublon ? "bg-amber-50/50" : l.erreur ? "bg-red-50/50" : "hover:bg-muted/30"}>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{l.referenceFacture || "—"}</td>
                          <td className="px-3 py-1.5">
                            <p className="font-medium truncate max-w-[120px]">{l.beneficiaire || "—"}</p>
                            <p className="text-muted-foreground">{l.matricule}</p>
                          </td>
                          <td className="px-3 py-1.5 truncate max-w-[140px]">{l.designation || "—"}</td>
                          <td className="px-3 py-1.5 truncate max-w-[140px]">{l.prestataireNom || "—"}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{l.datePrestation || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                            {l.partFinanceur > 0 ? l.partFinanceur.toLocaleString("fr-FR") : "—"}
                          </td>
                          <td className="px-3 py-1.5"><BadgeLigne l={l} /></td>
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
        {etape === "apercu" && apercu && apercu.totalResolues > 0 && (
          <div className="border-t px-6 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>{apercu.totalResolues} ligne(s) prête(s) à importer</span>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" onClick={fermer}>Annuler</Btn>
              <Btn size="sm" onClick={handleConfirmer}>
                Importer {apercu.totalResolues} ligne(s)
              </Btn>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

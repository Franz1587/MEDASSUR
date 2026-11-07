import { useState } from "react";
import { GitMerge, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { analyserDoublonsPec, nettoyerDoublonsPec, type BilanDoublonsPec } from "@/services/import.service";

// Doublons PEC vs factures : même prestation importée deux fois — une fois via
// l'import PEC (entente préalable, sans facture) et une fois via l'import
// factures régulier (avec facture). La ligne avec facture est conservée et reçoit
// l'accordPrealableId issu de la ligne PEC ; la ligne PEC est supprimée.
export function NettoyagePec() {
  const [bilan, setBilan] = useState<BilanDoublonsPec | null>(null);
  const [etat, setEtat] = useState<"repos" | "analyse" | "nettoyage">("repos");

  const analyser = async () => {
    setEtat("analyse");
    try { setBilan(await analyserDoublonsPec()); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Analyse impossible."); }
    finally { setEtat("repos"); }
  };

  const nettoyer = async () => {
    if (!bilan || !window.confirm(`Supprimer définitivement ${bilan.trouvees.toLocaleString("fr-FR")} ligne(s) en double (import PEC sans facture) ?`)) return;
    setEtat("nettoyage");
    try {
      const r = await nettoyerDoublonsPec();
      toast.success(`${r.supprimees.toLocaleString("fr-FR")} doublon(s) PEC supprimé(s)${r.accordsTransferes ? `, ${r.accordsTransferes} accord(s) préalable(s) rattaché(s) à la facture` : ""}.`);
      setBilan(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Nettoyage impossible."); }
    finally { setEtat("repos"); }
  };

  return (
    <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-muted-foreground flex items-center gap-2">
          <GitMerge className="w-4 h-4 flex-shrink-0" />
          Doublons PEC vs factures : prestations importées deux fois — une via l'import entente préalable (sans facture) et une via l'import factures (avec facture). La ligne avec facture est conservée.
        </p>
        <Btn variant="secondary" disabled={etat !== "repos"} onClick={analyser}>
          {etat === "analyse" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}Rechercher
        </Btn>
      </div>
      {bilan && (bilan.trouvees === 0 ? (
        <p className="text-[12.5px] text-green-700 dark:text-green-400">Aucun doublon PEC/facture : la base est propre.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-foreground">
            <span className="font-semibold">{bilan.trouvees.toLocaleString("fr-FR")}</span> ligne(s) PEC sans facture ont un équivalent avec facture dans la base.
          </p>
          <Btn variant="primary" className="!bg-red-600 hover:!bg-red-700" disabled={etat !== "repos"} onClick={nettoyer}>
            {etat === "nettoyage" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Supprimer les doublons PEC
          </Btn>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { referenceLisible } from "@/lib/referenceFacture";
import { analyserDoublons, nettoyerDoublons, type BilanDoublons } from "@/services/import.service";

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

// Doublons d'import (2026-11) — voir demande utilisateur : "nettoyer la base de
// tout doublon car ils faussent l'analyse des consommations". Aperçu chiffré
// d'abord, suppression seulement après confirmation explicite.
export function NettoyageDoublons() {
  const [bilan, setBilan] = useState<BilanDoublons | null>(null);
  const [etat, setEtat] = useState<"repos" | "analyse" | "nettoyage">("repos");

  const analyser = async () => {
    setEtat("analyse");
    try { setBilan(await analyserDoublons()); } catch (err) { toast.error(err instanceof Error ? err.message : "Analyse impossible."); } finally { setEtat("repos"); }
  };

  const nettoyer = async () => {
    if (!bilan || !window.confirm(`Supprimer définitivement ${bilan.lignesASupprimer.toLocaleString("fr-FR")} ligne(s) en double (${fcfa(bilan.montantASupprimer)}) et ${bilan.facturesVidees} en-tête(s) de facture vidé(s) ?`)) return;
    setEtat("nettoyage");
    try {
      const r = await nettoyerDoublons();
      toast.success(`${r.lignesSupprimees.toLocaleString("fr-FR")} doublon(s) supprimé(s), ${r.facturesSupprimees} facture(s) vide(s) retirée(s).`);
      setBilan(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Nettoyage impossible."); } finally { setEtat("repos"); }
  };

  return (
    <div className="mb-5 rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12.5px] text-muted-foreground flex items-center gap-2">
          <Copy className="w-4 h-4 flex-shrink-0" />
          Doublons d'import : prestations présentes plusieurs fois parce qu'un même fichier a été importé plusieurs fois (même facture, assuré, date et montant). Les répétitions d'un même fichier sont conservées.
        </p>
        <Btn variant="secondary" disabled={etat !== "repos"} onClick={analyser}>
          {etat === "analyse" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}Rechercher les doublons
        </Btn>
      </div>
      {bilan && (bilan.lignesASupprimer === 0 && bilan.lignesBloquees === 0 ? (
        <p className="text-[12.5px] text-green-700 dark:text-green-400">Aucun doublon : la base est propre.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-foreground">
            <span className="font-semibold">{bilan.lignesASupprimer.toLocaleString("fr-FR")}</span> ligne(s) en double dans {bilan.groupes.toLocaleString("fr-FR")} prestation(s), soit <span className="font-semibold">{fcfa(bilan.montantASupprimer)}</span> comptés en trop ; {bilan.facturesVidees} en-tête(s) de facture deviendraient vides.
            {bilan.lignesBloquees > 0 && ` ${bilan.lignesBloquees} copie(s) déjà rattachée(s) à un règlement ou à une prescription sont laissées en place.`}
          </p>
          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead><tr className="text-muted-foreground text-left">{["Prestataire", "Facture", "Date", "Montant", "Exemplaires", "Gardé(s)"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {bilan.exemples.map((e, i) => (
                  <tr key={i} className="border-t border-border/50 text-foreground">
                    <td className="px-2 py-1">{e.prestataire}</td><td className="px-2 py-1">{referenceLisible(e.reference) || "—"}</td><td className="px-2 py-1">{e.date}</td>
                    <td className="px-2 py-1">{fcfa(e.montant)}</td><td className="px-2 py-1">{e.exemplaires}</td><td className="px-2 py-1">{e.gardees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bilan.lignesASupprimer > 0 && (
            <Btn variant="primary" className="!bg-red-600 hover:!bg-red-700" disabled={etat !== "repos"} onClick={nettoyer}>
              {etat === "nettoyage" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Supprimer les doublons
            </Btn>
          )}
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listerOffresGenerees, openOffreGeneree, type OffreGeneree } from "@/services/documents.service";

// Historique des offres santé générées (PDF archivés tels que remis) :
// ouvert dans la visionneuse, qui permet de consulter, imprimer et télécharger.
// `version` change à chaque nouvelle génération pour recharger la liste.
export function HistoriqueOffres({ appelOffresId, version = 0 }: { appelOffresId?: string; version?: number }) {
  const [offres, setOffres] = useState<OffreGeneree[] | null>(null);
  const [ouverture, setOuverture] = useState<string | null>(null);

  useEffect(() => {
    listerOffresGenerees(appelOffresId).then(setOffres, () => setOffres([]));
  }, [appelOffresId, version]);

  const ouvrir = (id: string) => {
    setOuverture(id);
    openOffreGeneree(id)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Ouverture du document impossible."))
      .finally(() => setOuverture(null));
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm">Historique des offres générées</h3>
        <p className="text-[11.5px] text-muted-foreground">Chaque document est conservé tel qu'il a été généré — ouvrez-le pour le consulter, l'imprimer ou le télécharger.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {["Date", "Client", "Origine", "Cotations", "Pages", "Par", ""].map((h) => (
              <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(offres ?? []).map((o) => (
            <tr key={o.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num">{new Date(o.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
              <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{o.clientNom}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.origine}</td>
              <td className="px-4 py-3 text-right text-muted-foreground med-num">{o.cotationIds.length}</td>
              <td className="px-4 py-3 text-right text-muted-foreground med-num">{o.nbPages}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.creeParNom ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <button type="button" onClick={() => ouvrir(o.id)} disabled={ouverture === o.id}
                  className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-60">
                  {ouverture === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}Ouvrir
                </button>
              </td>
            </tr>
          ))}
          {offres?.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">Aucune offre générée pour l'instant</td></tr>
          )}
          {offres === null && (
            <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">Chargement…</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

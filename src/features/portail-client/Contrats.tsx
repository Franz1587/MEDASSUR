import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { getMesContrats } from "@/services/portailClient.service";
import type { Contrat } from "@/types/contrats";
import ContratDetail from "./ContratDetail";

function statutVariant(statut: string): BadgeVariant {
  if (statut === "Actif") return "success";
  if (statut === "En renouvellement") return "warning";
  return "neutral";
}

// Liste des contrats du souscripteur connecté (2026-08) — voir demande
// utilisateur : le portail doit permettre de "suivre la gestion de leur
// contrat maladie". Cloisonné côté serveur (voir getMesContrats), jamais
// les contrats d'un autre client. L'accès au détail ouvre une page dédiée
// à part entière (voir ContratDetail.tsx) — plus une simple fenêtre modale.
export default function PortailContratsView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratOuvert, setContratOuvert] = useState<Contrat | null>(null);

  useEffect(() => {
    getMesContrats().then(setContrats);
  }, []);

  if (contratOuvert) {
    return <ContratDetail contrat={contratOuvert} onRetour={() => setContratOuvert(null)} />;
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.35rem] font-bold text-foreground">Mes contrats</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{contrats.length} contrat(s)</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Référence</th>
              <th className="text-left px-4 py-2.5">Branche</th>
              <th className="text-left px-4 py-2.5">Compagnie</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Date d'effet</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {contrats.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/25 cursor-pointer" onClick={() => setContratOuvert(c)}>
                <td className="px-4 py-2.5 font-semibold text-foreground">{c.numeroPolice ?? c.id}</td>
                <td className="px-4 py-2.5 text-foreground">{c.branche}</td>
                <td className="px-4 py-2.5 text-foreground">{c.compagnie}</td>
                <td className="px-4 py-2.5"><Badge variant={statutVariant(c.statut)}>{c.statut}</Badge></td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.dateDebut}</td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setContratOuvert(c); }} className="text-muted-foreground hover:text-primary"><Eye className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {contrats.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun contrat.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

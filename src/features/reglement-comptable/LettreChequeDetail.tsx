import { useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getLettreCheque } from "@/services/reglementComptable.service";
import { openLettreCheque } from "@/services/documents.service";
import type { LettreChequeDetail as LettreChequeDetailType } from "@/types/reglementComptable";

export default function LettreChequeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [lettre, setLettre] = useState<LettreChequeDetailType | null>(null);

  useEffect(() => { getLettreCheque(id).then(setLettre); }, [id]);

  if (!lettre) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Lettre chèque N° {lettre.numero}</h3>
            <p className="text-[12px] text-muted-foreground">{lettre.banqueNom} — Chèque N° {lettre.numeroCheque} — {lettre.prestataireNom}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={lettre.statut === "Émise" ? "success" : "neutral"}>{lettre.statut}</Badge>
            <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Compagnie</p>
              <p className="text-[14px] font-bold text-foreground">{lettre.compagnieNom ?? "Plusieurs"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Montant du chèque (net à payer)</p>
              <p className="text-[15px] font-bold text-foreground">{fmtM(lettre.montantTotal)} FCFA</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Règlements couverts</p>
              <p className="text-[15px] font-bold text-foreground">{lettre.bordereaux.length}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Date d'émission</p>
              <p className="text-[15px] font-bold text-foreground">{lettre.dateEmission}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/20"><h4 className="text-[12px] font-semibold text-foreground">Règlements couverts par ce chèque</h4></div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  {["N° Règlement", "Période", "Lignes", "Net à payer", "Statut"].map((h) => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lettre.bordereaux.map((b) => (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap text-primary font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{b.numero}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{b.periode}</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap text-foreground">{b.nbPrisesEnCharge}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(b.montantNet)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><Badge variant="success">{b.statut}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lettre.bordereaux.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Aucun règlement</div>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end flex-shrink-0">
          <Btn variant="ghost" onClick={() => openLettreCheque(lettre.id)}><Printer className="w-4 h-4" />Imprimer</Btn>
        </div>
      </div>
    </div>
  );
}

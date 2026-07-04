import { useEffect, useState } from "react";
import { BookOpen, Filter, Plus, Download } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { getJournalEntries } from "@/services/comptabilite.service";
import type { JournalEntry } from "@/types/comptabilite";

export default function ComptabiliteView() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    getJournalEntries().then(setJournalEntries);
  }, []);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Comptabilité SYSCOHADA" subtitle="Journal général, grand livre et états financiers — Plan OHADA révisé" icon={BookOpen}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Exercice 2024</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouvelle saisie</Btn>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chiffre d'affaires", value: "847.2M", sub: "+18.4% vs N-1", up: true },
          { label: "Commissions perçues", value: "89.4M", sub: "Taux moyen 10.2%", up: true },
          { label: "Charges d'exploitation", value: "234.6M", sub: "Dont sinistres: 189M", up: false },
          { label: "Résultat net", value: "62.8M", sub: "Marge nette: 7.4%", up: true },
        ].map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
              {k.value} <span className="text-xs text-muted-foreground">XAF</span>
            </p>
            <p className={`text-xs mt-1 ${k.up ? "text-green-400" : "text-muted-foreground"}`}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">Journal Général — Octobre 2024</h3>
            <Badge variant="info">SYSCOHADA révisé</Badge>
          </div>
          <Btn variant="ghost"><Download className="w-4 h-4" />Export</Btn>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "N° Écriture", "Libellé", "Compte", "Débit (XAF)", "Crédit (XAF)"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((j, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{j.date}</td>
                <td className="px-4 py-3 text-xs text-primary font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{j.num}</td>
                <td className="px-4 py-3 text-sm text-foreground">{j.libelle}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{j.compte}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-400 whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {j.debit > 0 ? new Intl.NumberFormat("fr-FR").format(j.debit) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-400 whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {j.credit > 0 ? new Intl.NumberFormat("fr-FR").format(j.credit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

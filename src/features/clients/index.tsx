import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Download, Plus, Eye, Edit, User, Phone, Mail, MapPin, FileText, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmt } from "@/lib/format";
import { getClients } from "@/services/clients.service";
import type { Client } from "@/types/clients";

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"Tous" | "Entreprise" | "Particulier">("Tous");
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    getClients().then(setClients);
  }, []);

  const filtered = useMemo(
    () => clients.filter((c) => {
      const q = search.toLowerCase();
      return (
        (c.nom.toLowerCase().includes(q) || c.pays.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q)) &&
        (typeFilter === "Tous" || c.type === typeFilter)
      );
    }),
    [clients, search, typeFilter],
  );

  return (
    <div className="p-6">
      <ModuleHeader
        title="Gestion des Clients"
        subtitle={`${clients.length} clients enregistrés · ${clients.filter((c) => c.statut === "Actif").length} actifs`}
        icon={Users}
        actions={
          <>
            <Btn variant="secondary"><Download className="w-4 h-4" />Export</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouveau client</Btn>
          </>
        }
      />
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="Rechercher par nom, pays, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden">
          {(["Tous", "Entreprise", "Particulier"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2.5 text-sm transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground font-medium" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Client", "Pays", "Contrats", "Prime Totale", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-primary/8" : "hover:bg-secondary/40"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {c.nom.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.nom}</p>
                        <p className="text-xs text-muted-foreground">{c.type} · {c.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.pays}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{c.contrats}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(c.prime)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={c.statut === "Actif" ? "success" : "neutral"}>{c.statut}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucun résultat pour votre recherche</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          {selected ? (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-border">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3 ${selected.type === "Entreprise" ? "bg-primary/20 text-primary" : "bg-cyan-500/20 text-cyan-400"}`}>
                  {selected.nom.slice(0, 2).toUpperCase()}
                </div>
                <h3 className="font-bold text-foreground">{selected.nom}</h3>
                <p className="text-xs text-muted-foreground">{selected.type} · {selected.id}</p>
                <div className="mt-2"><Badge variant={selected.statut === "Actif" ? "success" : "neutral"}>{selected.statut}</Badge></div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: User, label: "Contact", value: selected.contact },
                  { icon: Phone, label: "Téléphone", value: selected.tel },
                  { icon: Mail, label: "Email", value: selected.email },
                  { icon: MapPin, label: "Pays", value: selected.pays },
                  { icon: FileText, label: "Contrats", value: `${selected.contrats} polices actives` },
                  { icon: TrendingUp, label: "Prime totale", value: fmt(selected.prime) },
                ].map(({ icon: I, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <I className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm text-foreground font-medium break-all">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Btn variant="primary" className="flex-1 justify-center"><Eye className="w-4 h-4" />Contrats</Btn>
                <Btn variant="secondary" className="flex-1 justify-center"><Edit className="w-4 h-4" />Éditer</Btn>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Sélectionnez un client<br />pour voir le détail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

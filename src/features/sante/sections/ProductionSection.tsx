import { useEffect, useState } from "react";
import { QrCode, UserPlus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getAssuresSante } from "@/services/sante.service";
import { getContrats } from "@/services/contrats.service";
import { getRenouvellements } from "@/services/renouvellements.service";
import { getAvenants } from "@/services/avenants.service";
import { getResiliations } from "@/services/resiliations.service";
import type { AssureSante } from "@/types/sante";
import type { Contrat } from "@/types/contrats";
import type { Renouvellement } from "@/types/renouvellements";
import type { Avenant } from "@/types/avenants";
import type { Resiliation } from "@/types/resiliations";

const isBrancheSante = (branche: string) => branche.toLowerCase().includes("santé");

function AffiliationTab() {
  const [assures, setAssures] = useState<AssureSante[]>([]);
  const [selected, setSelected] = useState<AssureSante | null>(null);

  useEffect(() => {
    getAssuresSante().then(setAssures);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Assurés Principaux ({assures.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Assuré", "Matricule", "Bénéf.", "Cotisation/mois", "Carte", "Statut"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assures.map((a) => (
              <tr key={a.id} onClick={() => setSelected(a)}
                className={`border-b border-border/50 cursor-pointer transition-colors ${selected?.id === a.id ? "bg-primary/8" : "hover:bg-secondary/30"}`}
              >
                <td className="px-4 py-3 font-semibold text-foreground text-sm">{a.nom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{a.matricule}</td>
                <td className="px-4 py-3 text-center text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{a.benef}</td>
                <td className="px-4 py-3 text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(a.cotisation)}</td>
                <td className="px-4 py-3"><Badge variant={a.statutCarte === "Bloquée" ? "danger" : "neutral"}>{a.statutCarte ?? "—"}</Badge></td>
                <td className="px-4 py-3"><Badge variant={a.statut === "Actif" ? "success" : "warning"}>{a.statut}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">{selected.nom} — Affiliation</h3>
            <Badge variant={selected.statutCarte === "Bloquée" ? "danger" : "success"}>{selected.statutCarte ?? "—"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">N° assuré</p><p className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{selected.numeroAssure ?? "—"}</p></div>
            <div><p className="text-muted-foreground">QR Code</p><p className="font-semibold text-foreground flex items-center gap-1" style={{ fontFamily: "'DM Mono', monospace" }}><QrCode className="w-3 h-3" />{selected.qrCode ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Date affiliation</p><p className="text-foreground">{selected.dateAffiliation ?? "—"}</p></div>
            <div><p className="text-muted-foreground">Statut matrimonial</p><p className="text-foreground">{selected.statutMatrimonial ?? "—"}</p></div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Ayants droit ({selected.ayantsDroit.length})</p>
            </div>
            <div className="space-y-1.5">
              {selected.ayantsDroit.map((ad) => (
                <div key={ad.nom} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 text-xs">
                  <span className="text-foreground">{ad.nom} <span className="text-muted-foreground">— {ad.lienParente}</span></span>
                  <Badge variant={ad.statut === "Actif" ? "success" : "neutral"}>{ad.statut}</Badge>
                </div>
              ))}
              {selected.ayantsDroit.length === 0 && <p className="text-xs text-muted-foreground">Aucun ayant droit déclaré</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 h-fit flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">Sélectionnez un assuré pour voir le détail d'affiliation</p>
        </div>
      )}
    </div>
  );
}

const statutVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "Actif": "success", "Appliqué": "success", "Validé": "success", "Effective": "success", "Renouvelé": "success",
  "Brouillon": "neutral", "À renouveler": "warning", "Relancé": "warning", "Demandée": "warning",
  "Perdu": "danger", "Suspendu": "danger",
};

function ContratsMouvementsTab() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [renouvellements, setRenouvellements] = useState<Renouvellement[]>([]);
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [resiliations, setResiliations] = useState<Resiliation[]>([]);

  useEffect(() => {
    getContrats().then((all) => {
      const sante = all.filter((c) => isBrancheSante(c.branche));
      setContrats(sante);
      const santeIds = new Set(sante.map((c) => c.id));
      getAvenants().then((all) => setAvenants(all.filter((a) => santeIds.has(a.contrat))));
    });
    getRenouvellements().then((all) => setRenouvellements(all.filter((r) => isBrancheSante(r.branche))));
    getResiliations().then((all) => setResiliations(all.filter((r) => isBrancheSante(r.branche))));
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Contrats Santé Collective ({contrats.length})</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">{["Réf.", "Client", "Compagnie", "Prime", "Statut"].map((h) => <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {contrats.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="px-4 py-3 text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground">{c.client}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{c.compagnie}</td>
                <td className="px-4 py-3 text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</td>
                <td className="px-4 py-3"><Badge variant={statutVariant[c.statut] ?? "neutral"}>{c.statut}</Badge></td>
              </tr>
            ))}
            {contrats.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Aucun contrat santé collective</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Renouvellements ({renouvellements.length})</h3></div>
          <div className="divide-y divide-border/50">
            {renouvellements.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-foreground">{r.client}</span><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></div>
                <p className="text-xs text-muted-foreground">{r.contrat} · {r.joursRestants}j restants</p>
              </div>
            ))}
            {renouvellements.length === 0 && <p className="px-4 py-6 text-xs text-center text-muted-foreground">Aucun renouvellement</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Avenants ({avenants.length})</h3></div>
          <div className="divide-y divide-border/50">
            {avenants.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-foreground">{a.type}</span><Badge variant={statutVariant[a.statut] ?? "neutral"}>{a.statut}</Badge></div>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
              </div>
            ))}
            {avenants.length === 0 && <p className="px-4 py-6 text-xs text-center text-muted-foreground">Aucun avenant</p>}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Résiliations ({resiliations.length})</h3></div>
          <div className="divide-y divide-border/50">
            {resiliations.map((r) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-foreground">{r.client}</span><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></div>
                <p className="text-xs text-muted-foreground">{r.motif}</p>
              </div>
            ))}
            {resiliations.length === 0 && <p className="px-4 py-6 text-xs text-center text-muted-foreground">Aucune résiliation</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductionSection() {
  const [tab, setTab] = useState<"affiliation" | "contrats">("affiliation");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["affiliation", "Affiliation & Cartes"], ["contrats", "Contrats & Mouvements"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground border border-transparent"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "affiliation" ? <AffiliationTab /> : <ContratsMouvementsTab />}
    </div>
  );
}

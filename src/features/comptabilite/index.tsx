import { useEffect, useState } from "react";
import { BookOpen, Filter, Plus, Download, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { DateInput } from "@/components/shared/DateInput";
import { fmt } from "@/lib/format";
import { getJournalEntries, createJournalEntry, type JournalEntryUpsertInput } from "@/services/comptabilite.service";
import { getLettrageClients, getLettrageFournisseurs } from "@/services/lettrage.service";
import { getPilotageAssurance } from "@/services/dashboard.service";
import type { JournalEntry } from "@/types/comptabilite";
import type { LettrageClient, LettrageFournisseur, MouvementLettrage } from "@/types/lettrage";
import type { PilotageAssurance } from "@/types/dashboard";

function emptyForm(): JournalEntryUpsertInput {
  return { date: new Date().toLocaleDateString("fr-FR"), libelle: "", compte: "", debit: 0, credit: 0 };
}

// Lettrage — écran dédié (2026-09) — voir demande utilisateur : "il faut
// que l'outil IA puisse également faire un vrai lettrage de compte" (sur
// les clients ET les fournisseurs) + "Les deux" (écran dédié ET chat IA).
// Même moteur que le lettrage du compte 411 côté Super Admin — voir
// backend/src/lettrage/lettrage.util.ts.
function PanneauLettrage<T extends { mouvements: MouvementLettrage[]; soldeNonLettre: number; lettrageComplet: boolean }>({
  donnees, getId, getNom, texteVide,
}: {
  donnees: T[] | null; getId: (t: T) => string; getNom: (t: T) => string; texteVide: string;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  if (!donnees) return <p className="text-[12.5px] text-muted-foreground text-center py-10">Chargement…</p>;
  if (donnees.length === 0) return <p className="text-[12.5px] text-muted-foreground text-center py-10">{texteVide}</p>;

  const totalNonLettre = donnees.reduce((s, g) => s + Math.abs(g.soldeNonLettre), 0);
  const nbIncomplets = donnees.filter((g) => !g.lettrageComplet).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Comptes suivis" value={String(donnees.length)} icon={ArrowLeftRight} />
        <StatCard title="Comptes non soldés" value={String(nbIncomplets)} icon={AlertTriangle} />
        <StatCard title="Solde non lettré (total)" value={fmt(totalNonLettre)} icon={ArrowLeftRight} />
      </div>
      <div className="space-y-2">
        {donnees.map((g) => {
          const id = getId(g);
          const estOuvert = ouvert === id;
          return (
            <div key={id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOuvert(estOuvert ? null : id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-foreground text-sm">{getNom(g)}</span>
                  <Badge variant={g.lettrageComplet ? "success" : "warning"}>
                    {g.lettrageComplet ? "Compte soldé" : "Solde ouvert"}
                  </Badge>
                </div>
                <span className="text-sm font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
                  <span className={g.soldeNonLettre > 0 ? "text-amber-600" : g.soldeNonLettre < 0 ? "text-emerald-600" : "text-muted-foreground"}>
                    {fmt(g.soldeNonLettre)}
                  </span>
                </span>
              </button>
              {estOuvert && (
                <table className="w-full text-sm border-t border-border">
                  <thead>
                    <tr className="border-b border-border">
                      {["Date", "Libellé", "Montant", "Lettre"].map((h) => (
                        <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.mouvements.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.date}</td>
                        <td className="px-3 py-2.5 text-foreground text-sm">{m.libelle}</td>
                        <td className="px-3 py-2.5 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>
                          <span className={m.montant > 0 ? "text-foreground" : "text-emerald-600"}>{fmt(m.montant)}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {m.lettre ? <Badge variant="neutral">{m.lettre}</Badge> : <span className="text-xs text-amber-600 font-medium">Non lettré</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComptabiliteView() {
  const [onglet, setOnglet] = useState<"journal" | "lettrageClients" | "lettrageFournisseurs">("journal");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [lettrageClients, setLettrageClients] = useState<LettrageClient[] | null>(null);
  const [lettrageFournisseurs, setLettrageFournisseurs] = useState<LettrageFournisseur[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<JournalEntryUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // KPI réels (2026-09) — voir demande utilisateur : "l'application remonte
  // encore certain mockdata pour les sociétés créées." Remplace 4 chiffres
  // écrits en dur ("847.2M"...) par la même agrégation réelle que le
  // tableau de bord principal (DashboardService.pilotage()).
  const [pilotage, setPilotage] = useState<PilotageAssurance | null>(null);

  const refresh = () => getJournalEntries().then(setJournalEntries);

  useEffect(() => {
    refresh();
    getPilotageAssurance().then(setPilotage);
  }, []);

  useEffect(() => {
    if (onglet === "lettrageClients" && !lettrageClients) getLettrageClients().then(setLettrageClients);
    if (onglet === "lettrageFournisseurs" && !lettrageFournisseurs) getLettrageFournisseurs().then(setLettrageFournisseurs);
  }, [onglet, lettrageClients, lettrageFournisseurs]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError(null);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.libelle || !form.compte || (form.debit === 0 && form.credit === 0)) {
      setFormError("Libellé, compte et un montant au débit ou au crédit sont obligatoires.");
      return;
    }
    try {
      setSubmitting(true);
      await createJournalEntry(form);
      setShowCreate(false);
      refresh();
      toast.success("Écriture enregistrée.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur de saisie.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Comptabilité SYSCOHADA" subtitle="Journal général, grand livre et états financiers — Plan OHADA révisé" icon={BookOpen}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Exercice 2024</Btn>
            <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle saisie</Btn>
          </>
        }
      />

      <div className="flex items-center gap-2 border-b border-border mb-1 flex-wrap">
        {([
          ["journal", "Journal général"],
          ["lettrageClients", "Lettrage clients"],
          ["lettrageFournisseurs", "Lettrage fournisseurs"],
        ] as const).map(([id, label]) => (
          <button
            key={id} type="button" onClick={() => setOnglet(id)}
            className={`px-3 py-2 text-[12.5px] font-semibold border-b-2 -mb-px transition-colors ${onglet === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === "lettrageClients" && (
        <PanneauLettrage
          donnees={lettrageClients}
          getId={(c) => c.clientId}
          getNom={(c) => c.clientNom}
          texteVide="Aucun client avec une prime ou un encaissement enregistré."
        />
      )}
      {onglet === "lettrageFournisseurs" && (
        <PanneauLettrage
          donnees={lettrageFournisseurs}
          getId={(f) => f.prestataireId}
          getNom={(f) => f.prestataireNom}
          texteVide="Aucun fournisseur avec un bordereau de règlement enregistré."
        />
      )}

      {onglet === "journal" && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chiffre d'affaires (commissions)", value: pilotage ? fmt(pilotage.commissionsPercues) : "…", sub: `Année ${pilotage?.annee ?? "—"}`, isPct: false },
          { label: "Primes émises", value: pilotage ? fmt(pilotage.primesEmisesCumule) : "…", sub: `${pilotage?.contratsActifs ?? 0} contrat(s) actif(s)`, isPct: false },
          { label: "Taux de commission moyen", value: pilotage ? `${pilotage.tauxCommissionMoyen.toFixed(1)}%` : "…", sub: "Sur primes émises", isPct: true },
          { label: "Charges d'exploitation", value: "0", sub: "Non suivies dans cette version", isPct: false },
        ].map((k) => (
          <div key={k.label} className="bg-card/92 border border-border/80 rounded-2xl p-4 shadow-[0_8px_20px_rgba(17,66,102,0.08)]">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-foreground med-num">
              {k.value} {!k.isPct && <span className="text-xs text-muted-foreground">FCFA</span>}
            </p>
            <p className="text-xs mt-1 text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card/92 border border-border/80 rounded-2xl overflow-x-auto shadow-[0_10px_24px_rgba(17,66,102,0.08)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm">Journal Général</h3>
            <Badge variant="info">SYSCOHADA révisé</Badge>
          </div>
          <Btn variant="ghost"><Download className="w-4 h-4" />Export</Btn>
        </div>
        <table className="w-full text-sm med-data-table">
          <thead>
            <tr className="border-b border-border">
              {["Date", "N° Écriture", "Libellé", "Compte", "Débit (FCFA)", "Crédit (FCFA)"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {journalEntries.map((j, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num med-col-date">{j.date}</td>
                <td className="px-4 py-3 text-xs text-primary font-semibold whitespace-nowrap med-num med-col-ref">{j.num}</td>
                <td className="px-4 py-3 text-sm text-foreground">{j.libelle}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-semibold med-num med-col-account">{j.compte}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap med-num med-col-money">
                  {j.debit > 0 ? new Intl.NumberFormat("fr-FR").format(j.debit) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap med-num med-col-money">
                  {j.credit > 0 ? new Intl.NumberFormat("fr-FR").format(j.credit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle écriture</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Date</div><DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Compte (plan OHADA)</div><input value={form.compte} onChange={(e) => setForm((v) => ({ ...v, compte: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" placeholder="701000" /></label>
              <label className="block md:col-span-2"><div className="text-[12px] text-muted-foreground mb-1.5">Libellé</div><input value={form.libelle} onChange={(e) => setForm((v) => ({ ...v, libelle: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Débit (FCFA)</div><input type="number" value={form.debit} onChange={(e) => setForm((v) => ({ ...v, debit: Number(e.target.value), credit: 0 }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
              <label className="block"><div className="text-[12px] text-muted-foreground mb-1.5">Crédit (FCFA)</div><input type="number" value={form.credit} onChange={(e) => setForm((v) => ({ ...v, credit: Number(e.target.value), debit: 0 }))} className="w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground" /></label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{formError ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={handleCreate} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



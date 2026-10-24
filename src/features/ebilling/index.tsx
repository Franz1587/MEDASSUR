import { useEffect, useState } from "react";
import { Smartphone, ArrowDownCircle, ArrowUpCircle, RefreshCw, X, Download } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import {
  getTransactions,
  initierPayin,
  initierPayout,
  type Transaction,
  type PayinInput,
  type PayoutInput,
} from "@/services/ebilling.service";
import { getPrestataires } from "@/services/prestataires.service";
import type { Prestataire } from "@/types/prestataires";

// Opérateurs disponibles (Gabon)
const OPERATEURS_PAYIN = [
  { value: "AIRTELMONEY", label: "Airtel Money (07x)" },
  { value: "MOOVMONEY4", label: "Moov Money (06x)" },
  { value: "VISA_MASTERCARD", label: "Visa / Mastercard" },
  { value: "SIMU", label: "Simulation (test sandbox)" },
];
const OPERATEURS_PAYOUT = [
  { value: "airtelmoney", label: "Airtel Money (07x)" },
  { value: "moovmoney4", label: "Moov Money (06x)" },
];

function statutVariant(s: string): BadgeVariant {
  switch (s) {
    case "paid": return "success";
    case "pending": return "warning";
    case "failed":
    case "expired": return "danger";
    case "created": return "info";
    default: return "neutral";
  }
}

function statutLabel(s: string) {
  const map: Record<string, string> = {
    created: "Créée", pending: "En attente", paid: "Payée", expired: "Expirée", failed: "Échouée",
  };
  return map[s] ?? s;
}

function operateurLabel(op?: string) {
  if (!op) return "—";
  const map: Record<string, string> = {
    AIRTELMONEY: "Airtel Money", airtelmoney: "Airtel Money",
    MOOVMONEY4: "Moov Money", moovmoney4: "Moov Money",
    VISA_MASTERCARD: "Visa/MC",
    SIMU: "Simulation",
  };
  return map[op] ?? op;
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exporterCsv(transactions: Transaction[]) {
  const entetes = [
    "Référence", "Type", "Opérateur", "Bénéficiaire/Payeur", "N° Mobile",
    "Montant (FCFA)", "Frais billing (FCFA)", "Net perçu (FCFA)",
    "ID opérateur", "Statut", "Date création", "Date paiement", "Description",
  ];
  const lignes = transactions.map((t) => {
    const frais = t.fraisBilling ?? 0;
    const net = t.montant - frais;
    return [
      t.reference,
      t.type === "PAYIN" ? "Encaissement" : "Décaissement",
      operateurLabel(t.operateur),
      t.payeurNom ?? "",
      t.payeurMsisdn ?? "",
      t.montant.toFixed(0),
      frais > 0 ? frais.toFixed(0) : "",
      frais > 0 ? net.toFixed(0) : "",
      t.transactionIdOperateur ?? "",
      statutLabel(t.statut),
      new Date(t.createdAt).toLocaleString("fr-FR"),
      t.paidAt ? new Date(t.paidAt).toLocaleString("fr-FR") : "",
      t.description,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";");
  });
  const csv = [entetes.map((h) => `"${h}"`).join(";"), ...lignes].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-ebilling-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Formulaire PAYIN ──────────────────────────────────────────────────────────

function PayinModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<PayinInput>({
    montant: 0, description: "", operateur: "AIRTELMONEY",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof PayinInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.montant || !form.description) {
      toast.error("Montant et description requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await initierPayin(form);
      if (res.redirectUrl) {
        window.open(res.redirectUrl, "_blank");
        toast.success(`Transaction créée. Fenêtre de paiement ouverte.`);
      } else {
        toast.success(`USSD envoyé — référence : ${res.reference}`);
      }
      onSuccess();
      onClose();
    } catch {
      toast.error("Échec de l'initiation du paiement.");
    } finally {
      setLoading(false);
    }
  };

  const field = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const label = "text-[12px] text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4 text-green-500" />
            Initier un encaissement
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className={label}>Opérateur *</p>
            <select className={field} value={form.operateur} onChange={(e) => set("operateur", e.target.value)}>
              {OPERATEURS_PAYIN.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className={label}>Montant (FCFA) *</p>
            <input type="number" className={field} min={1} value={form.montant || ""} onChange={(e) => set("montant", Number(e.target.value))} placeholder="Ex. 50000" />
          </div>
          <div>
            <p className={label}>Description *</p>
            <input type="text" className={field} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex. Cotisation contrat LC-2024-001" />
          </div>
          {form.operateur !== "VISA_MASTERCARD" && (
            <div>
              <p className={label}>Numéro Mobile Money</p>
              <input type="tel" className={field} value={form.msisdn ?? ""} onChange={(e) => set("msisdn", e.target.value)} placeholder="Ex. 077000001" />
            </div>
          )}
          <div>
            <p className={label}>Nom du payeur</p>
            <input type="text" className={field} value={form.nom ?? ""} onChange={(e) => set("nom", e.target.value)} placeholder="Optionnel" />
          </div>
          <div>
            <p className={label}>Email du payeur</p>
            <input type="email" className={field} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="Optionnel" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose} className="flex-1">Annuler</Btn>
          <Btn onClick={submit} disabled={loading} className="flex-1">{loading ? "Envoi…" : "Envoyer la demande"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Formulaire PAYOUT ─────────────────────────────────────────────────────────

const MOTIFS_PAYOUT = [
  { value: "reglement_facture",      label: "Règlement facture prestataire",  tpl: (nom: string) => `Règlement facture — ${nom}` },
  { value: "remboursement_assure",   label: "Remboursement assuré",           tpl: (nom: string) => `Remboursement assuré — ${nom}` },
  { value: "paiement_prestation",    label: "Paiement prestation santé",      tpl: (nom: string) => `Paiement prestation santé — ${nom}` },
  { value: "evacuation_sanitaire",   label: "Évacuation sanitaire",           tpl: (nom: string) => `Évacuation sanitaire — ${nom}` },
  { value: "autre",                  label: "Autre (saisie libre)",            tpl: () => "" },
];

function operateurFromMsisdn(msisdn: string): "airtelmoney" | "moovmoney4" {
  const n = msisdn.replace(/\s/g, "");
  if (n.startsWith("06") || n.startsWith("+24106")) return "moovmoney4";
  return "airtelmoney";
}

function PayoutModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [typeBenef, setTypeBenef] = useState<"prestataire" | "autre">("prestataire");
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [prestataire, setPrestataire] = useState<Prestataire | null>(null);
  const [motif, setMotif] = useState(MOTIFS_PAYOUT[0].value);
  const [form, setForm] = useState<PayoutInput>({
    montant: 0, msisdn: "", operateur: "airtelmoney", description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPrestataires().then(setPrestataires).catch(() => {});
  }, []);

  // Quand un prestataire est sélectionné : auto-remplir MSISDN, nom, opérateur, description
  const selectionnerPrestataire = (p: Prestataire | null) => {
    setPrestataire(p);
    if (!p) return;
    const msisdn = p.telephone?.replace(/\s/g, "") ?? "";
    const motifObj = MOTIFS_PAYOUT.find((m) => m.value === motif) ?? MOTIFS_PAYOUT[0];
    setForm((f) => ({
      ...f,
      msisdn,
      nom: p.nom,
      operateur: msisdn ? operateurFromMsisdn(msisdn) : f.operateur,
      description: motifObj.value !== "autre" ? motifObj.tpl(p.nom) : f.description,
    }));
  };

  // Quand le motif change : re-générer la description si un bénéficiaire est déjà sélectionné
  const changerMotif = (v: string) => {
    setMotif(v);
    const motifObj = MOTIFS_PAYOUT.find((m) => m.value === v) ?? MOTIFS_PAYOUT[0];
    const nom = prestataire?.nom ?? form.nom ?? "";
    if (motifObj.value !== "autre" && nom) {
      setForm((f) => ({ ...f, description: motifObj.tpl(nom) }));
    }
  };

  const set = (k: keyof PayoutInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.montant || !form.msisdn || !form.description) {
      toast.error("Montant, numéro et description requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await initierPayout(form);
      toast.success(`Décaissement initié — référence : ${res.reference}`);
      onSuccess();
      onClose();
    } catch {
      toast.error("Échec du décaissement.");
    } finally {
      setLoading(false);
    }
  };

  const field = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const lbl = "text-[12px] text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-blue-500" />
            Initier un décaissement
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Type de bénéficiaire */}
          <div>
            <p className={lbl}>Type de bénéficiaire *</p>
            <div className="flex gap-2">
              {(["prestataire", "autre"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTypeBenef(t); setPrestataire(null); setForm((f) => ({ ...f, msisdn: "", nom: "" })); }}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-medium border transition-colors ${typeBenef === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
                >
                  {t === "prestataire" ? "Prestataire de santé" : "Autre bénéficiaire"}
                </button>
              ))}
            </div>
          </div>

          {/* Sélection prestataire */}
          {typeBenef === "prestataire" && (
            <div>
              <p className={lbl}>Prestataire *</p>
              <Combobox
                options={prestataires}
                value={prestataire}
                onChange={selectionnerPrestataire}
                getId={(p) => p.id}
                getLabel={(p) => p.nom}
                getSubLabel={(p) => [p.telephone, p.type].filter(Boolean).join(" · ")}
                placeholder="Rechercher un prestataire…"
              />
              {prestataire?.telephone && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Mobile : <span className="font-mono text-foreground">{prestataire.telephone}</span>
                  {" · "}Opérateur détecté : <span className="text-foreground">{operateurFromMsisdn(prestataire.telephone) === "airtelmoney" ? "Airtel Money" : "Moov Money"}</span>
                </p>
              )}
              {prestataire && !prestataire.telephone && (
                <p className="text-[11px] text-amber-600 mt-1">⚠ Aucun numéro enregistré pour ce prestataire — saisie manuelle requise.</p>
              )}
            </div>
          )}

          {/* Saisie manuelle si Autre ou prestataire sans téléphone */}
          {(typeBenef === "autre" || (typeBenef === "prestataire" && prestataire && !prestataire.telephone)) && (
            <>
              <div>
                <p className={lbl}>Numéro du bénéficiaire *</p>
                <input type="tel" className={field} value={form.msisdn}
                  onChange={(e) => { set("msisdn", e.target.value); if (e.target.value) set("operateur", operateurFromMsisdn(e.target.value)); }}
                  placeholder="Ex. 077000001" />
              </div>
              <div>
                <p className={lbl}>Nom du bénéficiaire</p>
                <input type="text" className={field} value={form.nom ?? ""} onChange={(e) => set("nom", e.target.value)} placeholder="Ex. Jean-Pierre Ondo" />
              </div>
            </>
          )}

          {/* Opérateur */}
          <div>
            <p className={lbl}>Opérateur *</p>
            <select className={field} value={form.operateur} onChange={(e) => set("operateur", e.target.value)}>
              {OPERATEURS_PAYOUT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Montant */}
          <div>
            <p className={lbl}>Montant (FCFA) *</p>
            <input type="number" className={field} min={1} value={form.montant || ""} onChange={(e) => set("montant", Number(e.target.value))} placeholder="Ex. 150000" />
          </div>

          {/* Motif structuré */}
          <div>
            <p className={lbl}>Nature du décaissement *</p>
            <select className={field} value={motif} onChange={(e) => changerMotif(e.target.value)}>
              {MOTIFS_PAYOUT.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Description (pré-remplie, éditable) */}
          <div>
            <p className={lbl}>Description / Motif *</p>
            <input type="text" className={field} value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="Ex. Règlement facture — Clinique Amissa" />
            <p className="text-[11px] text-muted-foreground mt-0.5">Pré-rempli selon la sélection — modifiable.</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose} className="flex-1">Annuler</Btn>
          <Btn onClick={submit} disabled={loading} className="flex-1">{loading ? "Envoi…" : "Initier le virement"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Détail d'une transaction ───────────────────────────────────────────────────

function DetailModal({ t, onClose }: { t: Transaction; onClose: () => void }) {
  const frais = t.fraisBilling ?? 0;
  const net = t.montant - frais;
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Référence", value: t.reference, mono: true },
    { label: "Type", value: t.type === "PAYIN" ? "Encaissement (PAYIN)" : "Décaissement (PAYOUT)" },
    { label: "Opérateur", value: operateurLabel(t.operateur) },
    ...(t.payeurNom ? [{ label: t.type === "PAYIN" ? "Payeur" : "Bénéficiaire", value: t.payeurNom }] : []),
    ...(t.payeurMsisdn ? [{ label: "Numéro mobile", value: t.payeurMsisdn, mono: true }] : []),
    ...(t.payeurEmail ? [{ label: "Email", value: t.payeurEmail }] : []),
    { label: "Montant brut", value: fmtM(t.montant) },
    { label: "Frais billing", value: frais > 0 ? fmtM(frais) : "Non renseigné" },
    ...(frais > 0 ? [{ label: "Net perçu", value: fmtM(net) }] : []),
    { label: "Statut", value: statutLabel(t.statut) },
    ...(t.ebillingId ? [{ label: "ID E-Billing", value: t.ebillingId, mono: true }] : []),
    ...(t.payoutId ? [{ label: "ID SHAP Payout", value: t.payoutId, mono: true }] : []),
    ...(t.transactionIdOperateur ? [{ label: "ID opérateur Mobile Money", value: t.transactionIdOperateur, mono: true }] : []),
    { label: "Description", value: t.description },
    { label: "Date création", value: new Date(t.createdAt).toLocaleString("fr-FR") },
    ...(t.paidAt ? [{ label: "Date paiement", value: new Date(t.paidAt).toLocaleString("fr-FR") }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">Détail de la transaction</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="divide-y divide-border/60">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="text-[12px] text-muted-foreground shrink-0 w-44">{r.label}</dt>
              <dd className={`text-[13px] text-foreground text-right break-all ${r.mono ? "font-mono" : ""}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ── Vue principale ────────────────────────────────────────────────────────────

type Filtre = "tous" | "PAYIN" | "PAYOUT";
type FiltreStatut = "tous" | "paid" | "pending" | "failed" | "expired";

export default function EbillingView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tous");
  const [showPayin, setShowPayin] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);

  const refresh = () => {
    setLoading(true);
    getTransactions(filtre === "tous" ? undefined : filtre, filtreStatut === "tous" ? undefined : filtreStatut)
      .then(setTransactions)
      .catch(() => toast.error("Impossible de charger les transactions."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [filtre, filtreStatut]); // eslint-disable-line react-hooks/exhaustive-deps

  const txPayees = transactions.filter((t) => t.statut === "paid");
  const totalEncaisse = txPayees.filter((t) => t.type === "PAYIN").reduce((s, t) => s + t.montant, 0);
  const totalDecaisse = txPayees.filter((t) => t.type === "PAYOUT").reduce((s, t) => s + t.montant, 0);
  const totalFrais = txPayees.reduce((s, t) => s + (t.fraisBilling ?? 0), 0);
  const enAttente = transactions.filter((t) => t.statut === "pending").length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <ModuleHeader
        icon={Smartphone}
        title="Paiements électroniques"
        subtitle="E-Billing Digitech Africa — collecte (Mobile Money / Carte) et décaissements"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Btn variant="ghost" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Btn>
            <Btn variant="ghost" onClick={() => exporterCsv(transactions)}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Btn>
            <Btn variant="ghost" onClick={() => setShowPayout(true)}>
              <ArrowUpCircle className="w-3.5 h-3.5" />
              Décaisser
            </Btn>
            <Btn onClick={() => setShowPayin(true)}>
              <ArrowDownCircle className="w-3.5 h-3.5" />
              Encaisser
            </Btn>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total encaissé</p>
          <p className="text-[20px] font-bold text-green-600 dark:text-green-400 mt-1">{fmtM(totalEncaisse)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total décaissé</p>
          <p className="text-[20px] font-bold text-blue-600 dark:text-blue-400 mt-1">{fmtM(totalDecaisse)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Frais billing</p>
          <p className="text-[20px] font-bold text-orange-600 dark:text-orange-400 mt-1">{fmtM(totalFrais)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Commission Digitech</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">En attente</p>
          <p className="text-[20px] font-bold text-amber-600 dark:text-amber-400 mt-1">{enAttente}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["tous", "PAYIN", "PAYOUT"] as Filtre[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltre(f)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${filtre === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f === "tous" ? "Tous" : f === "PAYIN" ? "Encaissements" : "Décaissements"}
            </button>
          ))}
        </div>
        <select
          className="text-[12px] border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
        >
          <option value="tous">Tous les statuts</option>
          <option value="paid">Payées</option>
          <option value="pending">En attente</option>
          <option value="failed">Échouées</option>
          <option value="expired">Expirées</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Smartphone className="w-9 h-9 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucune transaction trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Référence</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Opérateur</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bénéficiaire / Payeur</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Montant</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Frais</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Net</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">ID opérateur</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {transactions.map((t) => {
                  const frais = t.fraisBilling ?? 0;
                  const net = frais > 0 ? t.montant - frais : null;
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setDetail(t)}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{t.reference}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${t.type === "PAYIN" ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                          {t.type === "PAYIN"
                            ? <ArrowDownCircle className="w-3.5 h-3.5" />
                            : <ArrowUpCircle className="w-3.5 h-3.5" />}
                          {t.type === "PAYIN" ? "Encaiss." : "Décaiss."}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap">{operateurLabel(t.operateur)}</td>
                      <td className="px-4 py-3 text-foreground">
                        {t.payeurNom && <span className="block font-medium">{t.payeurNom}</span>}
                        {t.payeurMsisdn && <span className="font-mono text-[11px] text-muted-foreground">{t.payeurMsisdn}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">{fmtM(t.montant)}</td>
                      <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {frais > 0 ? fmtM(frais) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {net != null ? fmtM(net) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {t.transactionIdOperateur ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statutVariant(t.statut)}>{statutLabel(t.statut)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-[12px]">
                        {new Date(t.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPayin && (
        <PayinModal onClose={() => setShowPayin(false)} onSuccess={refresh} />
      )}
      {showPayout && (
        <PayoutModal onClose={() => setShowPayout(false)} onSuccess={refresh} />
      )}
      {detail && (
        <DetailModal t={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

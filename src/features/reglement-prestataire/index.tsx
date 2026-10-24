import { useEffect, useState } from "react";
import { FileStack, Plus, CheckCircle, XCircle, Banknote, HandCoins, Printer, Search, History, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getBordereaux, validerBordereau, rejeterBordereau, payerBordereau, getHistoriqueReglements } from "@/services/reglement.service";
import { openReglement, openHistoriqueReglements } from "@/services/documents.service";
import { getPrestataires } from "@/services/prestataires.service";
import { initierPayout } from "@/services/ebilling.service";
import GenererReglementModal from "./GenererReglementModal";
import ReglementDetail from "./ReglementDetail";
import type { BordereauReglement, HistoriqueReglementResultat } from "@/types/reglement";
import type { Prestataire } from "@/types/prestataires";

// ── Modal paiement Mobile Money d'un bordereau ──────────────────────────────

const OPERATEURS_PAYOUT = [
  { value: "airtelmoney", label: "Airtel Money (07x)" },
  { value: "moovmoney4", label: "Moov Money (06x)" },
];

function operateurFromMsisdn(msisdn: string): "airtelmoney" | "moovmoney4" {
  return msisdn.replace(/\s/g, "").startsWith("06") ? "moovmoney4" : "airtelmoney";
}

function PayerMobileMoneyModal({
  bordereau,
  onClose,
  onSuccess,
}: {
  bordereau: BordereauReglement;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const msisdnInitial = bordereau.prestataireTelephone?.replace(/\s/g, "") ?? "";
  const [msisdn, setMsisdn] = useState(msisdnInitial);
  const [operateur, setOperateur] = useState<"airtelmoney" | "moovmoney4">(
    msisdnInitial ? operateurFromMsisdn(msisdnInitial) : "airtelmoney"
  );
  const [montant, setMontant] = useState(bordereau.montantValide ?? bordereau.montantTotal);
  const [description, setDescription] = useState(
    `Règlement bordereau ${bordereau.numero} — ${bordereau.prestataireNom}`
  );
  const [loading, setLoading] = useState(false);

  const field = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const lbl = "text-[12px] text-muted-foreground mb-1";

  const submit = async () => {
    if (!msisdn || !montant || !description) {
      toast.error("Numéro, montant et description requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await initierPayout({
        montant,
        msisdn,
        operateur,
        description,
        nom: bordereau.prestataireNom,
        prestataireId: bordereau.prestataireId,
        bordereauIds: [bordereau.id],
      });
      toast.success(`Paiement Mobile Money initié — réf. ${res.reference}`);
      onSuccess();
      onClose();
    } catch {
      toast.error("Échec du paiement Mobile Money.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-500" />
            Payer par Mobile Money
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Récapitulatif du bordereau */}
        <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-[13px]">
          <p className="font-semibold text-foreground">{bordereau.prestataireNom}</p>
          <p className="text-muted-foreground">Bordereau {bordereau.numero} · {bordereau.periode}</p>
          <p className="text-muted-foreground">{bordereau.nbPrisesEnCharge} prestation(s) · validé {fmtM(bordereau.montantValide ?? bordereau.montantTotal)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <p className={lbl}>Numéro Mobile Money du prestataire *</p>
            <input type="tel" className={field} value={msisdn}
              onChange={(e) => { setMsisdn(e.target.value); if (e.target.value) setOperateur(operateurFromMsisdn(e.target.value)); }}
              placeholder="Ex. 077000001" />
            {!bordereau.prestataireTelephone && (
              <p className="text-[11px] text-amber-600 mt-0.5">⚠ Aucun numéro enregistré pour ce prestataire.</p>
            )}
          </div>
          <div>
            <p className={lbl}>Opérateur *</p>
            <select className={field} value={operateur} onChange={(e) => setOperateur(e.target.value as "airtelmoney" | "moovmoney4")}>
              {OPERATEURS_PAYOUT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className={lbl}>Montant à virer (FCFA) *</p>
            <input type="number" className={field} min={1} value={montant || ""}
              onChange={(e) => setMontant(Number(e.target.value))} />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Montant validé : {fmtM(bordereau.montantValide ?? bordereau.montantTotal)}
            </p>
          </div>
          <div>
            <p className={lbl}>Motif / Description *</p>
            <input type="text" className={field} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" onClick={onClose} className="flex-1">Annuler</Btn>
          <Btn onClick={submit} disabled={loading} className="flex-1">
            {loading ? "Envoi…" : "Initier le virement Mobile Money"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5 whitespace-nowrap truncate";

const statutVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "Reçu": "info", "En validation": "warning", "Validé": "success", "Payé": "success", "Rejeté": "danger",
  "En attente MM": "warning",
};

export default function ReglementPrestataireView() {
  const [bordereaux, setBordereaux] = useState<BordereauReglement[]>([]);
  const [showGenerer, setShowGenerer] = useState(false);
  const [bordereauOuvert, setBordereauOuvert] = useState<string | null>(null);
  const [bordereauMM, setBordereauMM] = useState<BordereauReglement | null>(null);

  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [histPrestataireId, setHistPrestataireId] = useState("");
  const [histDu, setHistDu] = useState("");
  const [histAu, setHistAu] = useState("");
  const [histNumeroReglement, setHistNumeroReglement] = useState("");
  const [histReferenceDecompte, setHistReferenceDecompte] = useState("");
  const [histAssure, setHistAssure] = useState("");
  const [histReferenceReglementComptable, setHistReferenceReglementComptable] = useState("");
  const [historique, setHistorique] = useState<HistoriqueReglementResultat | null>(null);
  const [recherchant, setRecherchant] = useState(false);

  const refresh = async () => setBordereaux(await getBordereaux());

  useEffect(() => { refresh(); getPrestataires().then(setPrestataires); }, []);

  const filtresHistorique = {
    prestataireId: histPrestataireId || undefined,
    du: histDu || undefined,
    au: histAu || undefined,
    numeroReglement: histNumeroReglement || undefined,
    referenceDecompte: histReferenceDecompte || undefined,
    assure: histAssure || undefined,
    referenceReglementComptable: histReferenceReglementComptable || undefined,
  };

  const handleRechercherHistorique = async () => {
    setRecherchant(true);
    try {
      setHistorique(await getHistoriqueReglements(filtresHistorique));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  const handleValider = async (id: string) => {
    await validerBordereau(id);
    refresh();
  };
  const handleRejeter = async (id: string) => {
    await rejeterBordereau(id);
    refresh();
  };
  const handlePayer = async (id: string) => {
    const ref = window.prompt("Référence du virement :");
    if (!ref) return;
    await payerBordereau(id, ref);
    refresh();
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Règlement" subtitle="Paiement des factures aux prestataires et des remboursements aux assurés" icon={HandCoins}
        actions={<Btn variant="primary" onClick={() => setShowGenerer(true)}><Plus className="w-4 h-4" />Générer un règlement</Btn>}
      />
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Historique des factures par exercice</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              <label className="block">
                <div className={labelCls}>Prestataire</div>
                <Combobox
                  options={prestataires}
                  value={prestataires.find((p) => p.id === histPrestataireId) ?? null}
                  onChange={(p) => setHistPrestataireId(p?.id ?? "")}
                  getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                  allowClear clearLabel="Tous"
                />
              </label>
              <label className="block">
                <div className={labelCls}>Du</div>
                <DateInput value={histDu} onChange={setHistDu} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Au</div>
                <DateInput value={histAu} onChange={setHistAu} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>N° de règlement</div>
                <input value={histNumeroReglement} onChange={(e) => setHistNumeroReglement(e.target.value)} placeholder="ex. 12 835" className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Réf. décompte</div>
                <input value={histReferenceDecompte} onChange={(e) => setHistReferenceDecompte(e.target.value)} placeholder="N° décompte ou sinistre" className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Assuré / ayant droit</div>
                <input value={histAssure} onChange={(e) => setHistAssure(e.target.value)} placeholder="Nom, prénom ou matricule" className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Règlement comptable</div>
                <input value={histReferenceReglementComptable} onChange={(e) => setHistReferenceReglementComptable(e.target.value)} placeholder="N° chèque ou banque" className={fieldCls} />
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Btn variant="primary" onClick={handleRechercherHistorique} disabled={recherchant}>
                <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
              </Btn>
              {historique && (
                <Btn variant="ghost" onClick={() => openHistoriqueReglements(filtresHistorique)}>
                  <Printer className="w-4 h-4" />Imprimer / télécharger l'état
                </Btn>
              )}
            </div>

            {historique && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {historique.exercices.map((e) => (
                    <div key={e.annee} className="bg-secondary/30 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-foreground">{e.annee}</p>
                      <p className="text-[10px] text-muted-foreground">{e.nbLignes} ligne{e.nbLignes > 1 ? "s" : ""} — {fmtM(e.montantDeclare)} déclaré</p>
                    </div>
                  ))}
                  {historique.exercices.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-full py-4 text-center">Aucun exercice pour ces critères.</p>
                  )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="max-h-80 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border bg-secondary/20">
                          {["Exercice", "Date de soin", "Assuré", "Prestataire", "Facture", "N° Décompte", "N° Règlement", "Rgt. comptable", "Frais réel", "Remboursé", "Statut"].map((h) => (
                            <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historique.lignes.map((l) => (
                          <tr
                            key={l.id}
                            onClick={() => l.bordereauId && setBordereauOuvert(l.bordereauId)}
                            className={`border-b border-border/50 ${l.bordereauId ? "cursor-pointer hover:bg-secondary/30" : ""}`}
                          >
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground font-semibold">{l.exercice}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.date}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground">{l.assureNom}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.prestataireNom}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.factureReference ?? "—"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.decompteNumero ?? "—"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-primary font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{l.bordereauNumero ?? "—"}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {l.numeroCheque ? (
                                <span title={`Lettre chèque ${l.lettreChequeNumero}`}>
                                  <Badge variant="success">Chèque N° {l.numeroCheque} — {l.banqueNom}</Badge>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap text-green-500" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montantRembourse)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap"><Badge variant={statutVariant[l.bordereauStatut ?? ""] ?? "neutral"}>{l.bordereauStatut ?? "—"}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {historique.lignes.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Aucune ligne pour ces critères.</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileStack className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Règlements établis ({bordereaux.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Réf.", "Prestataire", "Période", "Lignes", "Montant total", "Montant validé", "Statut", "Règlement comptable", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bordereaux.map((b) => (
                <tr key={b.id} onClick={() => setBordereauOuvert(b.id)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }} title={b.id}>{b.numero}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{b.prestataireNom}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.periode}</td>
                  <td className="px-4 py-3 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{b.nbPrisesEnCharge}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(b.montantTotal)}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{b.montantValide !== undefined ? fmtM(b.montantValide) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[b.statut] ?? "neutral"}>{b.statut}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.numeroCheque ? (
                      <span title={`Lettre chèque ${b.lettreChequeNumero}`}>
                        <Badge variant="success">Chèque N° {b.numeroCheque} — {b.banqueNom}</Badge>
                      </span>
                    ) : b.transactionEbillingId ? (
                      <span title={`Mobile Money — réf. ${b.referenceTransaction ?? b.transactionEbillingId}`}>
                        <Badge variant={b.statut === "Payé" ? "success" : "warning"}>
                          <Smartphone className="w-3 h-3 inline mr-0.5" />
                          {b.statut === "Payé" ? `MM — ${b.referenceTransaction ?? "confirmé"}` : "MM en attente"}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openReglement(b.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Imprimer"><Printer className="w-4 h-4" /></button>
                      {b.statut === "Reçu" && (
                        <>
                          <button onClick={() => handleValider(b.id)} className="p-1.5 rounded hover:bg-secondary text-green-400" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => handleRejeter(b.id)} className="p-1.5 rounded hover:bg-secondary text-red-400" title="Rejeter"><XCircle className="w-4 h-4" /></button>
                        </>
                      )}
                      {b.statut === "Validé" && (
                        <>
                          <Btn variant="ghost" onClick={() => handlePayer(b.id)}><Banknote className="w-4 h-4" />Marquer payé</Btn>
                          <Btn variant="ghost" onClick={() => setBordereauMM(b)}>
                            <Smartphone className="w-4 h-4 text-blue-500" />Mobile Money
                          </Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bordereaux.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucun règlement</div>}
        </div>

      </div>

      {showGenerer && (
        <GenererReglementModal onClose={() => setShowGenerer(false)} onGenerated={refresh} />
      )}
      {bordereauOuvert && (
        <ReglementDetail bordereauId={bordereauOuvert} onClose={() => setBordereauOuvert(null)} onChanged={refresh} />
      )}
      {bordereauMM && (
        <PayerMobileMoneyModal
          bordereau={bordereauMM}
          onClose={() => setBordereauMM(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { UserPlus, UserMinus, Check, X, UserCog } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { DateInput } from "@/components/shared/DateInput";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getDemandesClient, trancherDemandeClient, prendreDemandeClient } from "@/services/demandeClient.service";
import { assurePhotoUrl } from "@/services/sante.service";
import { useAuth } from "@/auth/AuthContext";
import type { CotisationBeneficiaireInput, DemandeClient } from "@/types/demandeClient";

function statutVariant(statut: string): BadgeVariant {
  if (statut === "Accordée") return "success";
  if (statut === "Refusée") return "danger";
  return "warning";
}

const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint", EF: "Enfant" };

const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";
const fieldCls = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground";

function libelleBeneficiaires(d: DemandeClient): string {
  if (d.type !== "Incorporation") return d.assureRetraitNom ?? "—";
  return d.beneficiaires.map((b) => `${b.nom} ${b.prenom ?? ""}`.trim()).join(", ") || "—";
}

// Traitement gestionnaire des demandes de mouvement soumises depuis le
// portail client (2026-08) — voir demande utilisateur : "la validation
// finale revient au gestionnaire côté assurance". Accorder déclenche le
// mouvement réel (voir DemandesClientService.decider, même moteur que
// l'écran "Gérer les assurés"). Une incorporation peut porter plusieurs
// bénéficiaires (assuré principal + ayants droit) — chacun a sa propre
// tarification (ayants droit/cotisation) à fixer avant d'accorder.
export default function DemandesClientView() {
  const { currentUser } = useAuth();
  const [demandes, setDemandes] = useState<DemandeClient[]>([]);
  const [filtreStatut, setFiltreStatut] = useState("En attente");
  const [enDecision, setEnDecision] = useState<{ demande: DemandeClient; decision: "Accordée" | "Refusée" } | null>(null);
  const [dateEffet, setDateEffet] = useState("");
  const [cotisations, setCotisations] = useState<Record<string, { beneficiaires: number; cotisation: number }>>({});
  const [motifRefus, setMotifRefus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pagination = usePagination(demandes);

  const refresh = () => getDemandesClient(filtreStatut === "Toutes" ? undefined : filtreStatut).then(setDemandes);

  useEffect(() => { refresh(); }, [filtreStatut]);

  // Prise en main d'un dossier (2026-09) — voir demande utilisateur :
  // "étendre le fait de prendre en main un dossier aux agents de saisie,
  // gestionnaire sinistre et gestionnaires production".
  const prendre = async (d: DemandeClient) => {
    try {
      await prendreDemandeClient(d.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de prendre ce dossier.");
    }
  };

  const ouvrirDecision = (demande: DemandeClient, decision: "Accordée" | "Refusée") => {
    setEnDecision({ demande, decision });
    setDateEffet(format(new Date(), "dd/MM/yyyy"));
    setCotisations(Object.fromEntries(demande.beneficiaires.map((b) => [b.id, { beneficiaires: 0, cotisation: 0 }])));
    setMotifRefus("");
  };

  const majCotisation = (beneficiaireId: string, champ: "beneficiaires" | "cotisation", valeur: number) => {
    setCotisations((v) => ({ ...v, [beneficiaireId]: { ...v[beneficiaireId], [champ]: valeur } }));
  };

  const confirmerDecision = async () => {
    if (!enDecision) return;
    try {
      setSubmitting(true);
      const cotisationsPayload: CotisationBeneficiaireInput[] = enDecision.demande.beneficiaires.map((b) => ({
        beneficiaireId: b.id, beneficiaires: cotisations[b.id]?.beneficiaires ?? 0, cotisation: cotisations[b.id]?.cotisation ?? 0,
      }));
      await trancherDemandeClient(enDecision.demande.id, {
        decision: enDecision.decision,
        dateEffet: enDecision.decision === "Accordée" ? dateEffet : undefined,
        motifRefus: enDecision.decision === "Refusée" ? motifRefus : undefined,
        cotisations: enDecision.demande.type === "Incorporation" ? cotisationsPayload : undefined,
      });
      setEnDecision(null);
      refresh();
      toast.success(enDecision.decision === "Accordée" ? "Demande accordée — mouvement appliqué." : "Demande refusée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Décision impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Demandes client" subtitle="Incorporations et retraits soumis depuis le portail des souscripteurs" icon={UserCog} />

      <div className="flex gap-2 mb-4">
        {["En attente", "Accordée", "Refusée", "Toutes"].map((s) => (
          <button key={s} type="button" onClick={() => setFiltreStatut(s)} className={`h-8 px-3 rounded-lg text-[12.5px] font-medium border ${filtreStatut === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Bénéficiaire(s)</th>
              <th className="text-left px-4 py-2.5">Souscripteur</th>
              <th className="text-left px-4 py-2.5">Contrat</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Pris en charge</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {pagination.pageItems.map((d) => (
              <tr key={d.id} className="hover:bg-secondary/25">
                <td className="px-4 py-2.5 text-foreground flex items-center gap-1.5">
                  {d.type === "Incorporation" ? <UserPlus className="w-3.5 h-3.5 text-emerald-600" /> : <UserMinus className="w-3.5 h-3.5 text-amber-600" />}
                  {d.type}
                </td>
                <td className="px-4 py-2.5 text-foreground">{libelleBeneficiaires(d)}</td>
                <td className="px-4 py-2.5 text-foreground">{d.clientNom ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.contratReference ?? d.contratId}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.dateDemande}</td>
                <td className="px-4 py-2.5"><Badge variant={statutVariant(d.statut)}>{d.statut}</Badge></td>
                <td className="px-4 py-2.5">
                  {d.statut !== "En attente" ? (
                    <span className="text-muted-foreground text-[11.5px]">—</span>
                  ) : !d.gestionnaireId ? (
                    <button type="button" onClick={() => prendre(d)} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium inline-flex items-center gap-1">
                      <UserPlus className="w-3 h-3" />Prendre
                    </button>
                  ) : d.gestionnaireId === currentUser?.id ? (
                    <Badge variant="success">Vous</Badge>
                  ) : (
                    <Badge variant="neutral">Pris en charge</Badge>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {d.statut === "En attente" && (
                    <div className="flex items-center gap-1.5 justify-end">
                      <button type="button" onClick={() => ouvrirDecision(d, "Accordée")} className="h-7 px-2.5 rounded-lg bg-emerald-500/12 text-emerald-700 text-[11.5px] font-medium hover:bg-emerald-500/20 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Accorder</button>
                      <button type="button" onClick={() => ouvrirDecision(d, "Refusée")} className="h-7 px-2.5 rounded-lg bg-red-500/12 text-red-700 text-[11.5px] font-medium hover:bg-red-500/20 flex items-center gap-1"><X className="w-3.5 h-3.5" />Refuser</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {demandes.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucune demande.</td></tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {enDecision && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold text-foreground">
                {enDecision.decision === "Accordée" ? "Accorder la demande" : "Refuser la demande"}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">{enDecision.demande.type} — {libelleBeneficiaires(enDecision.demande)}</p>
            </div>
            <div className="p-5 space-y-4">
              {enDecision.decision === "Accordée" ? (
                <>
                  <label className="block"><div className={labelCls}>Date d'effet</div><DateInput value={dateEffet} onChange={setDateEffet} className={fieldCls} /></label>
                  {enDecision.demande.type === "Incorporation" && (
                    <div className="space-y-3">
                      {enDecision.demande.beneficiaires.map((b) => (
                        <div key={b.id} className="border border-border rounded-lg p-3">
                          <div className="flex items-center gap-2.5 mb-2">
                            {b.photo ? (
                              <img src={assurePhotoUrl(b.photo)} alt="" className="w-9 h-9 rounded-full object-cover border border-border" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-[10px] text-muted-foreground">—</div>
                            )}
                            <div>
                              <p className="text-[13px] font-medium text-foreground">{b.nom} {b.prenom ?? ""}</p>
                              <p className="text-[11px] text-muted-foreground">{LABEL_TYPE[b.typeAssure]}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block"><div className={labelCls}>Ayants droit</div><input type="number" min={0} value={cotisations[b.id]?.beneficiaires ?? 0} onChange={(e) => majCotisation(b.id, "beneficiaires", Number(e.target.value))} className={fieldCls} /></label>
                            <label className="block"><div className={labelCls}>Cotisation/mois (FCFA)</div><input type="number" min={0} value={cotisations[b.id]?.cotisation ?? 0} onChange={(e) => majCotisation(b.id, "cotisation", Number(e.target.value))} className={fieldCls} /></label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <label className="block"><div className={labelCls}>Motif du refus</div><textarea value={motifRefus} onChange={(e) => setMotifRefus(e.target.value)} className={`${fieldCls} h-20 py-2`} /></label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEnDecision(null)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submitting} onClick={confirmerDecision} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

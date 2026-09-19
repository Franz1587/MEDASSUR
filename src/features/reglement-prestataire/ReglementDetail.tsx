import { useEffect, useState } from "react";
import { X, Printer, CheckCircle, XCircle, Banknote, Stethoscope, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { getBordereau, validerBordereau, rejeterBordereau, payerBordereau, definirMedecinBordereau } from "@/services/reglement.service";
import { openReglement } from "@/services/documents.service";
import { getMedecins, type Medecin } from "@/services/medecins.service";
import type { BordereauReglementDetail } from "@/types/reglement";

const statutVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "Reçu": "info", "En validation": "warning", "Validé": "success", "Payé": "success", "Rejeté": "danger",
};

export default function ReglementDetail({ bordereauId, onClose, onChanged }: { bordereauId: string; onClose: () => void; onChanged?: () => void }) {
  const [bordereau, setBordereau] = useState<BordereauReglementDetail | null>(null);
  const [editionMedecin, setEditionMedecin] = useState(false);
  const [medecinsStructure, setMedecinsStructure] = useState<Medecin[]>([]);

  const refresh = () => getBordereau(bordereauId).then(setBordereau);
  useEffect(() => { refresh(); }, [bordereauId]);

  // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur :
  // "lorsqu'on fait un règlement pour une structure médicale, que le
  // règlement se fasse à l'ordre d'un médecin intervenant dans la
  // structure" — modifiable après coup tant que non payé.
  const ouvrirEditionMedecin = () => {
    if (bordereau) getMedecins({ prestataireId: bordereau.prestataireId }).then(setMedecinsStructure);
    setEditionMedecin(true);
  };
  const choisirMedecin = async (medecinId: string | null) => {
    try {
      await definirMedecinBordereau(bordereauId, medecinId);
      setEditionMedecin(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    }
  };

  const handleValider = async () => { await validerBordereau(bordereauId); refresh(); onChanged?.(); };
  const handleRejeter = async () => { await rejeterBordereau(bordereauId); refresh(); onChanged?.(); };
  const handlePayer = async () => {
    const ref = window.prompt("Référence du virement :");
    if (!ref) return;
    await payerBordereau(bordereauId, ref);
    refresh();
    onChanged?.();
  };

  if (!bordereau) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Règlement N° {bordereau.numero}</h3>
            <p className="text-[12px] text-muted-foreground">{bordereau.prestataireNom} — {bordereau.periode}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statutVariant[bordereau.statut] ?? "neutral"}>{bordereau.statut}</Badge>
            <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="rounded-lg border border-border p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12.5px]">
              <Stethoscope className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">À l'ordre de :</span>
              <span className="text-foreground font-semibold">{bordereau.medecinNom ?? bordereau.prestataireNom}</span>
            </div>
            {editionMedecin ? (
              <div className="w-64">
                <Combobox
                  options={medecinsStructure}
                  value={medecinsStructure.find((m) => m.id === bordereau.medecinId) ?? null}
                  onChange={(m) => choisirMedecin(m?.id ?? null)}
                  getLabel={(m) => `${m.titre ? `${m.titre} ` : ""}${m.nom}${m.prenom ? ` ${m.prenom}` : ""}`}
                  getSubLabel={(m) => m.specialite ?? ""} getId={(m) => m.id}
                  allowClear clearLabel="La structure elle-même"
                  placeholder="Rechercher un médecin…"
                />
              </div>
            ) : bordereau.statut !== "Payé" && (
              <button type="button" onClick={ouvrirEditionMedecin} className="text-[11.5px] font-medium text-primary hover:underline inline-flex items-center gap-1">
                <Pencil className="w-3 h-3" />Modifier
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Lignes</p>
              <p className="text-[15px] font-bold text-foreground">{bordereau.nbPrisesEnCharge}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Montant total</p>
              <p className="text-[15px] font-bold text-foreground">{fmtM(bordereau.montantTotal)} FCFA</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Montant validé</p>
              <p className="text-[15px] font-bold text-foreground">{bordereau.montantValide !== undefined ? `${fmtM(bordereau.montantValide)} FCFA` : "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Réception</p>
              <p className="text-[15px] font-bold text-foreground">{bordereau.dateReception}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-secondary/20"><h4 className="text-[12px] font-semibold text-foreground">Décomptes / déclarations liés</h4></div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  {["Famille", "Bénéficiaire du soin", "N° Décompte", "N° Déclaration", "Date", "Montant", "Statut"].map((h) => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bordereau.lignes.map((l) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.familleNom}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-foreground">{l.assureNom}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.decompteNumero ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.factureReference ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-foreground">{l.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bordereau.lignes.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">Aucune ligne</div>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <Btn variant="ghost" onClick={() => openReglement(bordereau.id)}><Printer className="w-4 h-4" />Imprimer</Btn>
          <div className="flex items-center gap-2">
            {bordereau.statut === "Reçu" && (
              <>
                <Btn variant="ghost" onClick={() => { handleValider(); toast.success("Bordereau validé."); }}><CheckCircle className="w-4 h-4 text-green-500" />Valider</Btn>
                <Btn variant="ghost" onClick={() => { handleRejeter(); toast.success("Bordereau rejeté."); }}><XCircle className="w-4 h-4 text-red-500" />Rejeter</Btn>
              </>
            )}
            {bordereau.statut === "Validé" && (
              <Btn variant="primary" onClick={handlePayer}><Banknote className="w-4 h-4" />Marquer payé</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

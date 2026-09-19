import { useEffect, useState } from "react";
import { X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { getContrats } from "@/services/contrats.service";
import { createEncaissement } from "@/services/encaissements.service";
import type { Contrat } from "@/types/contrats";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Mobile Money"];

// Saisie d'un encaissement de prime (2026-08) — voir demande utilisateur :
// aucun autre flux ne génère ces paiements aujourd'hui, la donnée est
// purement déclarative (ce que le client a réellement payé).
export default function NouvelEncaissementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratId, setContratId] = useState("");
  const [montant, setMontant] = useState("");
  const [dateEncaissement, setDateEncaissement] = useState("");
  const [modePaiement, setModePaiement] = useState("");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { getContrats().then(setContrats); }, []);

  const contratSelectionne = contrats.find((c) => c.id === contratId) ?? null;
  const montantValide = Number(montant) > 0;
  const peutEnregistrer = !!contratId && montantValide && !!dateEncaissement;

  const handleEnregistrer = async () => {
    if (!peutEnregistrer) return;
    setSaving(true);
    try {
      await createEncaissement({
        contratId,
        montant: Number(montant),
        dateEncaissement,
        modePaiement: modePaiement || undefined,
        referencePaiement: referencePaiement || undefined,
        note: note || undefined,
      });
      toast.success("Encaissement enregistré.");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />Nouvel encaissement de prime</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-3.5">
          <label className="block">
            <div className={labelCls}>Contrat / Souscripteur *</div>
            <Combobox
              options={contrats}
              value={contratSelectionne}
              onChange={(c) => setContratId(c?.id ?? "")}
              getLabel={(c) => c.client}
              getSubLabel={(c) => `${c.numeroPolice ?? c.id} — ${c.compagnie}`}
              getId={(c) => c.id}
              placeholder="Rechercher un souscripteur…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className={labelCls}>Montant encaissé (FCFA) *</div>
              <input type="number" min={1} value={montant} onChange={(e) => setMontant(e.target.value)} className={fieldCls} placeholder="0" />
            </label>
            <label className="block">
              <div className={labelCls}>Date d'encaissement *</div>
              <DateInput value={dateEncaissement} onChange={setDateEncaissement} className={fieldCls} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className={labelCls}>Mode de paiement</div>
              <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={fieldCls}>
                <option value="">—</option>
                {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <div className={labelCls}>Référence paiement</div>
              <input value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className={fieldCls} placeholder="N° chèque, réf. virement…" />
            </label>
          </div>

          <label className="block">
            <div className={labelCls}>Note</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={fieldCls} />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <Btn variant="primary" onClick={handleEnregistrer} disabled={saving || !peutEnregistrer}>{saving ? "Enregistrement…" : "Enregistrer"}</Btn>
        </div>
      </div>
    </div>
  );
}

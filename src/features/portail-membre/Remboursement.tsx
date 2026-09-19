import { useEffect, useState } from "react";
import { Receipt, Plus, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { getReseauSoins, type PrestataireReseau } from "@/services/reseauSoins.service";
import { getActesMedicaux } from "@/services/acteMedical.service";
import type { ActeMedical } from "@/types/acteMedical";
import {
  getMesPrisesEnCharge, creerRemboursement, getMoi, getMaFamille,
  uploaderPrescriptionRemboursement, uploaderFactureRemboursement, uploaderQuittanceRemboursement, uploaderAutreRemboursement,
  type MembrePriseEnCharge, type CreateRemboursementInput, type MembreIdentite, type MembreFamilleMembre,
} from "@/services/portailMembre.service";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2.5 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function statutVariant(s: string): BadgeVariant {
  return s === "Accordé" ? "success" : s === "Rejeté" ? "danger" : "warning";
}

function emptyForm(): CreateRemboursementInput {
  return { prestataire: "", type: "", montant: 0, date: "" };
}

interface DocSlot { cle: "prescription" | "facture" | "quittance" | "autre"; label: string }
const SLOTS: DocSlot[] = [
  { cle: "prescription", label: "Prescription médicale" },
  { cle: "facture", label: "Facture normalisée" },
  { cle: "quittance", label: "Quittance laboratoire" },
  { cle: "autre", label: "Autre document" },
];
const UPLOADERS = {
  prescription: uploaderPrescriptionRemboursement, facture: uploaderFactureRemboursement,
  quittance: uploaderQuittanceRemboursement, autre: uploaderAutreRemboursement,
};

// Remboursement (2026-08) — voir demande utilisateur : "Partagez les
// documents et devis relatifs pour votre demande de remboursement"
// (modèle de référence fourni par l'utilisateur). Soumission libre-service complète (pas juste un
// historique) — crée une vraie PriseEnCharge modePaiement=Remboursement.
export default function MembreRemboursementView() {
  const [lignes, setLignes] = useState<MembrePriseEnCharge[] | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [form, setForm] = useState<CreateRemboursementInput>(emptyForm());
  const [fichiers, setFichiers] = useState<Partial<Record<DocSlot["cle"], File>>>({});
  const [envoi, setEnvoi] = useState(false);
  const [prestataires, setPrestataires] = useState<PrestataireReseau[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [prestataireChoisi, setPrestataireChoisi] = useState<PrestataireReseau | null>(null);
  const [acteChoisi, setActeChoisi] = useState<ActeMedical | null>(null);
  // Bénéficiaire réel des frais (2026-09) — voir demande utilisateur : "on
  // puisse clairement indiquer pour qui dans la famille on a engagé les
  // frais, l'assuré principal ou un ayant droit".
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [famille, setFamille] = useState<MembreFamilleMembre[]>([]);
  const [beneficiaireId, setBeneficiaireId] = useState<string | undefined>(undefined);

  const rafraichir = () => getMesPrisesEnCharge("Remboursement").then(setLignes);
  useEffect(() => {
    rafraichir();
    getReseauSoins().then(setPrestataires);
    getActesMedicaux().then(setActes);
    getMoi().then((m) => { setMoi(m); setBeneficiaireId((v) => v ?? m.id); });
    getMaFamille().then(setFamille);
  }, []);

  // Validation (2026-08) — voir demande utilisateur : "en ce qui concerne le
  // remboursement seul les pièces doivent être jointes... la date et l'ajout
  // des pièces peuvent être suffisantes pour faire la demande". Acte,
  // prestataire et montant deviennent facultatifs — le gestionnaire les
  // complète/corrige à l'examen des justificatifs (voir
  // PortailMembreController.creerRemboursement).
  const soumettre = async () => {
    if (!form.date) {
      toast.error("La date est obligatoire.");
      return;
    }
    if (Object.keys(fichiers).length === 0) {
      toast.error("Merci de joindre au moins un justificatif.");
      return;
    }
    setEnvoi(true);
    try {
      const cree = await creerRemboursement({ ...form, beneficiaireId });
      await Promise.all(
        SLOTS.filter((s) => fichiers[s.cle]).map((s) => UPLOADERS[s.cle](cree.id, fichiers[s.cle]!)),
      );
      toast.success("Demande de remboursement envoyée.");
      setFormulaireOuvert(false);
      setForm(emptyForm());
      setPrestataireChoisi(null);
      setActeChoisi(null);
      setBeneficiaireId(moi?.id);
      setFichiers({});
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.2rem] font-bold text-foreground">Remboursement</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Vos demandes de remboursement</p>
        </div>
        <Btn variant="primary" onClick={() => setFormulaireOuvert(true)}><Plus className="w-4 h-4" />Nouvelle</Btn>
      </div>

      {!lignes ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : lignes.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucune demande pour l'instant.</div>
      ) : (
        <div className="space-y-2.5">
          {lignes.map((l) => (
            <div key={l.id} className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{l.type}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{l.prestataire} · {l.date}</p>
                </div>
                <Badge variant={statutVariant(l.statut)}>{l.statut}</Badge>
              </div>
              <div className="flex items-center justify-between mt-2 text-[12px]">
                <span className="text-muted-foreground">Frais réels</span>
                <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)} FCFA</span>
              </div>
              {l.baseRemboursement != null && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Remboursé</span>
                  <span className="text-emerald-600 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.baseRemboursement)} FCFA</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formulaireOuvert && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl p-4 max-h-[88vh] overflow-y-auto space-y-3.5">
            <p className="text-[14px] font-semibold text-foreground flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" />Nouvelle demande de remboursement</p>

            {famille.length > 0 && moi ? (
              <label className="block">
                <div className={labelCls}>Frais engagés pour *</div>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim() + " (vous)" }, ...famille.map((f) => ({ id: f.id, nom: `${f.nom} ${f.prenom ?? ""}`.trim() }))].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBeneficiaireId(p.id)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${beneficiaireId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/40"}`}
                    >
                      {p.nom}
                    </button>
                  ))}
                </div>
              </label>
            ) : null}
            <label className="block">
              <div className={labelCls}>Date du sinistre *</div>
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} className={fieldCls} />
            </label>
            <label className="block">
              <div className={labelCls}>Acte / soin (facultatif)</div>
              <Combobox
                options={actes}
                value={acteChoisi}
                onChange={(a) => {
                  setActeChoisi(a);
                  setForm((v) => ({ ...v, type: a?.libelle ?? "", acteMedicalId: a?.id }));
                }}
                getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
                placeholder="Rechercher un acte…"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Prestataire (facultatif)</div>
              <Combobox
                options={prestataires}
                value={prestataireChoisi}
                onChange={(p) => {
                  setPrestataireChoisi(p);
                  setForm((v) => ({ ...v, prestataire: p?.nom ?? "", prestataireId: p?.id }));
                }}
                getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                placeholder="Rechercher un prestataire…"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Montant réel payé (FCFA, facultatif)</div>
              <input type="number" value={form.montant || ""} onChange={(e) => setForm((v) => ({ ...v, montant: Number(e.target.value) }))} className={fieldCls} />
            </label>

            {SLOTS.map((s) => (
              <label key={s.cle} className="block">
                <div className={labelCls}>{s.label}</div>
                <div className="flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2.5">
                  <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input type="file" onChange={(e) => setFichiers((f) => ({ ...f, [s.cle]: e.target.files?.[0] }))} className="text-[12px] text-muted-foreground w-full" />
                  {fichiers[s.cle] && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </div>
              </label>
            ))}
            <p className="text-[10.5px] text-muted-foreground -mt-2">Au moins un justificatif est obligatoire pour envoyer la demande.</p>

            <div className="flex items-center gap-2 pt-1">
              <button type="button" onClick={() => setFormulaireOuvert(false)} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <Btn variant="primary" onClick={soumettre} disabled={envoi} className="flex-1 justify-center">{envoi ? "Envoi…" : "Envoyer"}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

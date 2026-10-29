import { useState } from "react";
import { Search, CheckCircle, AlertCircle } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { toast } from "sonner";
import { http, messageErreur } from "@/lib/http";

interface Medicament { nom: string; dosage?: string; quantite?: string; duree?: string; }
interface OrdonnanceResult {
  id: string;
  codeAccesPharmacie: string;
  dateValidite: string;
  decision: string;
  medicaments: Medicament[];
  assure: { id: string; nom: string; prenom: string | null; };
}

const fieldCls = "w-full border border-border rounded-lg px-3 py-2.5 bg-background text-[13px] text-foreground font-mono uppercase placeholder:normal-case";

export default function OrdonnancesPharmacie() {
  const [code, setCode] = useState("");
  const [ordonnance, setOrdonnance] = useState<OrdonnanceResult | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [delivree, setDelivree] = useState(false);

  async function rechercher() {
    if (!code.trim()) return;
    setChargement(true); setErreur(null); setOrdonnance(null); setDelivree(false);
    try {
      const data = await http.get<OrdonnanceResult>(`/accord-prealable/pharmacie/${code.trim().toUpperCase()}`);
      setOrdonnance(data);
    } catch (e) {
      setErreur(messageErreur(e) ?? "Code introuvable ou ordonnance expirée.");
    } finally {
      setChargement(false);
    }
  }

  async function confirmerDelivrance() {
    if (!ordonnance) return;
    setChargement(true);
    try {
      await http.patch(`/accord-prealable/pharmacie/${ordonnance.codeAccesPharmacie}/delivrer`, {});
      setDelivree(true);
      toast.success("Délivrance confirmée. L'ordonnance est marquée comme servie.");
    } catch (e) {
      toast.error(messageErreur(e) ?? "Erreur lors de la confirmation.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Ordonnances électroniques</h2>
        <p className="text-[13px] text-muted-foreground mt-1">
          Entrez le code communiqué par l'assuré pour accéder à son ordonnance et confirmer la délivrance.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ex : ORD-2026-AB12CD"
          value={code}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && rechercher()}
          className={fieldCls}
        />
        <Btn variant="primary" onClick={rechercher} disabled={chargement || !code.trim()}>
          <Search className="w-4 h-4 mr-1.5" /> Rechercher
        </Btn>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-[13px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {erreur}
        </div>
      )}

      {ordonnance && !delivree && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-muted-foreground">Patient</p>
              <p className="font-semibold text-foreground">{ordonnance.assure.prenom} {ordonnance.assure.nom}</p>
            </div>
            <Badge variant="info">{ordonnance.codeAccesPharmacie}</Badge>
          </div>
          <div>
            <p className="text-[13px] text-muted-foreground mb-0.5">Valide jusqu'au</p>
            <p className="text-[13px] font-medium text-foreground">{ordonnance.dateValidite}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted-foreground mb-2">Médicaments prescrits</p>
            <div className="space-y-2">
              {ordonnance.medicaments.length === 0 ? (
                <p className="text-[13px] text-muted-foreground italic">Aucun médicament extrait automatiquement — consulter l'ordonnance originale.</p>
              ) : (
                ordonnance.medicaments.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 text-[13px]">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">{i + 1}</span>
                    <div>
                      <p className="font-medium text-foreground">{m.nom}</p>
                      {(m.dosage || m.quantite || m.duree) && (
                        <p className="text-muted-foreground mt-0.5">
                          {[m.dosage, m.quantite, m.duree].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <Btn variant="primary" onClick={confirmerDelivrance} disabled={chargement} className="w-full justify-center">
            <CheckCircle className="w-4 h-4 mr-1.5" /> Confirmer la délivrance
          </Btn>
        </div>
      )}

      {delivree && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[13px]">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Délivrance confirmée</p>
            <p className="text-[12px] mt-0.5">L'ordonnance a été marquée comme servie dans le système.</p>
          </div>
        </div>
      )}
    </div>
  );
}

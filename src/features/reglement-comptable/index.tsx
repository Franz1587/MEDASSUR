import { useEffect, useState } from "react";
import { Banknote, Plus, Landmark, Eye, Printer, FileStack, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getLettresCheque } from "@/services/reglementComptable.service";
import { openLettreCheque } from "@/services/documents.service";
import { getPrestataires } from "@/services/prestataires.service";
import { getBanques } from "@/services/banques.service";
import { getCompagnies } from "@/services/compagnies.service";
import GenererLettreChequeModal from "./GenererLettreChequeModal";
import GestionBanquesModal from "./GestionBanquesModal";
import LettreChequeDetail from "./LettreChequeDetail";
import type { LettreCheque } from "@/types/reglementComptable";
import type { Prestataire } from "@/types/prestataires";
import type { Banque } from "@/types/banques";
import type { Compagnie } from "@/types/compagnies";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5 whitespace-nowrap truncate";

export default function ReglementComptableView() {
  const [lettresCheque, setLettresCheque] = useState<LettreCheque[] | null>(null);
  const [showGenererLettreCheque, setShowGenererLettreCheque] = useState(false);
  const [showGestionBanques, setShowGestionBanques] = useState(false);
  const [lettreChequeOuverte, setLettreChequeOuverte] = useState<string | null>(null);

  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [banques, setBanques] = useState<Banque[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);

  // Mêmes critères de recherche que l'historique de l'écran "Règlement",
  // adaptés au règlement comptable (voir demande utilisateur).
  const [filtrePrestataireId, setFiltrePrestataireId] = useState("");
  const [filtreBanqueId, setFiltreBanqueId] = useState("");
  const [filtreCompagnieId, setFiltreCompagnieId] = useState("");
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");
  const [filtreReference, setFiltreReference] = useState("");
  const [recherchant, setRecherchant] = useState(false);

  const filtresActuels = {
    prestataireId: filtrePrestataireId || undefined,
    banqueId: filtreBanqueId || undefined,
    compagnieId: filtreCompagnieId || undefined,
    du: filtreDu || undefined,
    au: filtreAu || undefined,
    reference: filtreReference || undefined,
  };

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setLettresCheque(await getLettresCheque(filtresActuels));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => {
    getPrestataires().then(setPrestataires);
    getBanques().then(setBanques);
    getCompagnies().then(setCompagnies);
  }, []);
  // Recherche initiale (sans filtre) au chargement de l'écran.
  useEffect(() => { handleRechercher(); }, []);

  return (
    <div className="p-6">
      <ModuleHeader
        title="Règlement comptable"
        subtitle="Lettres chèque et séries de chèques par banque"
        icon={Banknote}
        actions={(
          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={() => setShowGestionBanques(true)}><Landmark className="w-4 h-4" />Gérer les banques</Btn>
            <Btn variant="primary" onClick={() => setShowGenererLettreCheque(true)}><Plus className="w-4 h-4" />Générer un règlement comptable</Btn>
          </div>
        )}
      />

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Rechercher des lettres chèque</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <label className="block">
                <div className={labelCls}>Prestataire</div>
                <Combobox
                  options={prestataires}
                  value={prestataires.find((p) => p.id === filtrePrestataireId) ?? null}
                  onChange={(p) => setFiltrePrestataireId(p?.id ?? "")}
                  getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                  allowClear clearLabel="Tous"
                />
              </label>
              <label className="block">
                <div className={labelCls}>Banque</div>
                <Combobox
                  options={banques}
                  value={banques.find((b) => b.id === filtreBanqueId) ?? null}
                  onChange={(b) => setFiltreBanqueId(b?.id ?? "")}
                  getLabel={(b) => b.nom} getId={(b) => b.id}
                  allowClear clearLabel="Toutes"
                />
              </label>
              <label className="block">
                <div className={labelCls}>Compagnie</div>
                <Combobox
                  options={compagnies}
                  value={compagnies.find((c) => c.id === filtreCompagnieId) ?? null}
                  onChange={(c) => setFiltreCompagnieId(c?.id ?? "")}
                  getLabel={(c) => c.nom} getId={(c) => c.id}
                  allowClear clearLabel="Toutes"
                />
              </label>
              <label className="block">
                <div className={labelCls}>Du</div>
                <DateInput value={filtreDu} onChange={setFiltreDu} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>Au</div>
                <DateInput value={filtreAu} onChange={setFiltreAu} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>N° lettre ou chèque</div>
                <input value={filtreReference} onChange={(e) => setFiltreReference(e.target.value)} placeholder="ex. LC-000003 ou 5576001" className={fieldCls} />
              </label>
            </div>
            <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}>
              <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
            </Btn>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <FileStack className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Lettres chèque émises ({lettresCheque?.length ?? 0})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["N°", "Banque", "N° Chèque", "Prestataire", "Compagnie", "Montant", "Date", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(lettresCheque ?? []).map((l) => (
                <tr key={l.id} onClick={() => setLettreChequeOuverte(l.id)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{l.numero}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{l.banqueNom}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{l.numeroCheque}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{l.prestataireNom}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.compagnieNom ?? "Plusieurs"}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montantTotal)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{l.dateEmission}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={l.statut === "Émise" ? "success" : "neutral"}>{l.statut}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setLettreChequeOuverte(l.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Voir"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openLettreCheque(l.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Imprimer"><Printer className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lettresCheque?.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucune lettre chèque pour ces critères</div>}
        </div>
      </div>

      {showGenererLettreCheque && (
        <GenererLettreChequeModal
          onClose={() => setShowGenererLettreCheque(false)}
          onGenerated={handleRechercher}
          onGererBanques={() => setShowGestionBanques(true)}
        />
      )}
      {showGestionBanques && (
        <GestionBanquesModal onClose={() => setShowGestionBanques(false)} onChanged={() => getBanques().then(setBanques)} />
      )}
      {lettreChequeOuverte && (
        <LettreChequeDetail id={lettreChequeOuverte} onClose={() => setLettreChequeOuverte(null)} />
      )}
    </div>
  );
}

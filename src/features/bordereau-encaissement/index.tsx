import { useEffect, useState } from "react";
import { Coins, Printer, Search, Plus, FileSpreadsheet } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getBordereauEncaissement } from "@/services/bordereaux.service";
import type { BordereauProductionPayload } from "@/services/bordereaux.service";
import { openBordereauEncaissement } from "@/services/documents.service";
import { getCompagnies } from "@/services/compagnies.service";
import type { Compagnie } from "@/types/compagnies";
import NouvelEncaissementModal from "./NouvelEncaissementModal";

const fieldCls = "border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Bordereau d'Encaissement de Prime (2026-08) — voir demande utilisateur :
// "exactement le même document [que Production] dans la forme", mais
// retrace les primes réellement encaissées (EncaissementPrime), pas les
// primes émises (Contrat). Groupé par compagnie, même disposition. Une
// compagnie précise peut aussi être choisie pour générer le bordereau
// destiné à cette seule compagnie (voir demande utilisateur : "chaque type
// de bordereau doit pouvoir être généré par compagnie").
export default function BordereauEncaissementView() {
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [compagnieId, setCompagnieId] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [payload, setPayload] = useState<BordereauProductionPayload | null>(null);
  const [recherchant, setRecherchant] = useState(false);
  const [modalOuverte, setModalOuverte] = useState(false);

  useEffect(() => { getCompagnies().then(setCompagnies); }, []);

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setPayload(await getBordereauEncaissement(du || undefined, au || undefined, compagnieId || undefined));
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => { handleRechercher(); }, [compagnieId]);

  return (
    <div className="p-6">
      <ModuleHeader title="Bordereau d'Encaissement" subtitle="Primes réellement encaissées auprès des souscripteurs, par compagnie" icon={Coins} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block w-64">
            <div className={labelCls}>Compagnie</div>
            <Combobox
              options={compagnies}
              value={compagnies.find((c) => c.id === compagnieId) ?? null}
              onChange={(c) => setCompagnieId(c?.id ?? "")}
              getLabel={(c) => c.nom} getId={(c) => c.id}
              allowClear clearLabel="Toutes"
            />
          </label>
          <label className="block">
            <div className={labelCls}>Du</div>
            <DateInput value={du} onChange={setDu} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Au</div>
            <DateInput value={au} onChange={setAu} className={fieldCls} />
          </label>
          <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}><Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}</Btn>
          <Btn variant="ghost" onClick={() => openBordereauEncaissement(du || undefined, au || undefined, compagnieId || undefined)}><Printer className="w-4 h-4" />Imprimer ce bordereau</Btn>
          <Btn variant="ghost" onClick={() => openBordereauEncaissement(du || undefined, au || undefined, compagnieId || undefined, "xlsx")}><FileSpreadsheet className="w-4 h-4" />Excel</Btn>
          <div className="flex-1" />
          <Btn variant="primary" onClick={() => setModalOuverte(true)}><Plus className="w-4 h-4" />Nouvel encaissement</Btn>
        </div>
      </div>

      {!payload ? (
        <div className="bg-card border border-border rounded-xl py-10 text-center text-muted-foreground text-sm">Chargement…</div>
      ) : (
        <div className="space-y-5">
          {payload.groupes.map((g) => (
            <div key={g.compagnie} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold text-sm">{g.compagnie}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      {["N° Police", "Code Assuré", "Num Quittance", "Date émis. Quit.", "Date encaissement", "Nom Souscripteur/Assuré", "Date début", "Date fin", "Produit", "Capitaux", "Primes", "Access.", "Taxes", "Primes Tot.", "Commis."].map((h) => (
                        <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-2.5 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.lignes.length === 0 ? (
                      <tr><td colSpan={15} className="px-2.5 py-4 text-center text-muted-foreground italic">Aucune entrée pour la période sélectionnée</td></tr>
                    ) : (
                      g.lignes.map((l, i) => (
                          <tr key={i} className="border-b border-border/40 hover:bg-secondary/20">
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.numeroPolice}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.codeAssure}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.numQuittance}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.dateEmisQuittance}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.dateAvenant || "—"}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap font-semibold text-foreground">{l.nomSouscripteur}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{l.dateDebut}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{l.dateFin}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{l.produit}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap text-muted-foreground">{l.capitauxAssures}</td>
                            <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.primes)}</td>
                            <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.access)}</td>
                            <td className="px-2.5 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.taxes)}</td>
                            <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.primesTotales)}</td>
                            <td className="px-2.5 py-1.5 text-muted-foreground">N/A</td>
                          </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-secondary/30 font-bold">
                      <td colSpan={10} className="px-2.5 py-2 text-foreground text-right">Total</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.primes)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.access)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.taxes)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.primesTotales)}</td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.commission)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOuverte && (
        <NouvelEncaissementModal
          onClose={() => setModalOuverte(false)}
          onCreated={handleRechercher}
        />
      )}
    </div>
  );
}

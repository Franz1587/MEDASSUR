import { useEffect, useState } from "react";
import { Calculator, Sparkles, Save } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getCotations, simuler, creerCotation } from "@/services/cotation.service";
import type { Cotation, CotationInput, TarifCalcule } from "@/types/cotation";

const defaultInput: CotationInput = {
  clientNom: "", agePopulationMoyen: 32, sexeRatio: "50H/50F", historiqueSinistres: 45,
  niveauGaranties: "Confort", territorialite: "Zone CIMA", stopLoss: 0, primePure: 10_000_000, effectifAssure: 50,
};

const inputClass = "w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors";
const labelClass = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export default function CotationView() {
  const [input, setInput] = useState<CotationInput>(defaultInput);
  const [resultat, setResultat] = useState<TarifCalcule | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [cotations, setCotations] = useState<Cotation[]>([]);

  useEffect(() => {
    getCotations().then(setCotations);
  }, []);

  const set = <K extends keyof CotationInput>(key: K, value: CotationInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));

  const handleSimuler = async () => {
    setSimulating(true);
    try {
      setResultat(await simuler(input));
    } finally {
      setSimulating(false);
    }
  };

  const handleEnregistrer = async () => {
    if (!resultat) return;
    await creerCotation(input);
    setCotations(await getCotations());
    setResultat(null);
  };

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Cotation — Pricing Engine" subtitle="Simulation tarifaire : prime pure, chargements, marge, commission, PEPM" icon={Calculator} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Client</label>
              <input className={inputClass} value={input.clientNom} onChange={(e) => set("clientNom", e.target.value)} placeholder="Nom du client / prospect" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Âge moyen population</label>
              <input type="number" className={inputClass} value={input.agePopulationMoyen} onChange={(e) => set("agePopulationMoyen", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Sexe ratio</label>
              <input className={inputClass} value={input.sexeRatio} onChange={(e) => set("sexeRatio", e.target.value)} placeholder="50H/50F" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Historique sinistres (S/P %)</label>
              <input type="number" className={inputClass} value={input.historiqueSinistres} onChange={(e) => set("historiqueSinistres", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Niveau garanties</label>
              <select className={inputClass} value={input.niveauGaranties} onChange={(e) => set("niveauGaranties", e.target.value)}>
                <option>Essentiel</option>
                <option>Confort</option>
                <option>Premium</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Territorialité</label>
              <input className={inputClass} value={input.territorialite} onChange={(e) => set("territorialite", e.target.value)} placeholder="Zone CIMA / CEMAC / International" />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Stop-loss (XAF)</label>
              <input type="number" className={inputClass} value={input.stopLoss} onChange={(e) => set("stopLoss", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Effectif assuré</label>
              <input type="number" className={inputClass} value={input.effectifAssure} onChange={(e) => set("effectifAssure", Number(e.target.value))} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className={labelClass}>Prime pure (base actuarielle, XAF)</label>
              <input type="number" className={inputClass} value={input.primePure} onChange={(e) => set("primePure", Number(e.target.value))} />
            </div>
          </div>
          <Btn variant="primary" onClick={handleSimuler} className="justify-center w-full">
            <Sparkles className="w-4 h-4" />{simulating ? "Calcul en cours…" : "Simuler le tarif"}
          </Btn>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground text-sm mb-3">Résultat</h3>
          {resultat ? (
            <div className="space-y-2.5">
              {[
                { label: "Prime pure", value: input.primePure },
                { label: "Chargements", value: resultat.chargements },
                { label: "Marge technique", value: resultat.marge },
                { label: "Commission courtage", value: resultat.commission },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.value)}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Tarif final</span>
                <span className="text-lg font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(resultat.tarifFinal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">PEPM (par employé/mois)</span>
                <span className="font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{Math.round(resultat.pepm).toLocaleString("fr-FR")} XAF</span>
              </div>
              <Btn variant="secondary" onClick={handleEnregistrer} className="justify-center w-full mt-2">
                <Save className="w-4 h-4" />Enregistrer la cotation
              </Btn>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Renseignez les paramètres et lancez une simulation</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Cotations enregistrées</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Client", "Niveau", "Territorialité", "Tarif final", "PEPM", "Date"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cotations.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.clientNom}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.niveauGaranties}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.territorialite}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.tarifFinal)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{Math.round(c.pepm).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.dateCreation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

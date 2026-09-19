import { Fragment, useEffect, useMemo, useState } from "react";
import { Receipt, Printer, FileStack, ChevronRight, ChevronDown, Search } from "lucide-react";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getEtatTps, getPrestataires, type LigneEtatTps } from "@/services/prestataires.service";
import { openEtatTps, openListePrestatairesTps } from "@/services/documents.service";
import type { Prestataire } from "@/types/prestataires";

const fieldCls = "border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = Array.from({ length: 6 }, (_, i) => String(ANNEE_COURANTE - i));

export default function EtatTpsView() {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [prestataireId, setPrestataireId] = useState("");
  const [annee, setAnnee] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [lignes, setLignes] = useState<LigneEtatTps[] | null>(null);
  const [recherchant, setRecherchant] = useState(false);
  // Chaque ligne agrégée (prestataire × mois) est repliable — on y trouve
  // le détail par facture qui a motivé le prélèvement, voir feedback
  // "Facture égale détails" : cet état n'est pas qu'un total global, il
  // est aussi transmis individuellement à chaque prestataire concerné.
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());

  const filtresActuels = { prestataireId: prestataireId || undefined, annee: annee || undefined, du: du || undefined, au: au || undefined };

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setLignes(await getEtatTps(filtresActuels));
    } finally {
      setRecherchant(false);
    }
  };

  useEffect(() => { getPrestataires().then(setPrestataires); }, []);
  // Recherche initiale (tous prestataires, aucun filtre) au chargement de
  // l'écran — ensuite, un changement de filtre ne relance rien tant que
  // "Rechercher" n'est pas cliqué, cohérent avec les autres écrans de
  // recherche de l'application (Règlement, Génération de règlement).
  useEffect(() => { handleRechercher(); }, []);

  const assujettis = useMemo(() => prestataires.filter((p) => p.tpsAssujetti), [prestataires]);
  const totalTps = (lignes ?? []).reduce((s, l) => s + l.totalTps, 0);

  const toggle = (cle: string) => setOuvertes((s) => {
    const next = new Set(s);
    if (next.has(cle)) next.delete(cle); else next.add(cle);
    return next;
  });

  return (
    <div className="p-6">
      <ModuleHeader title="État TPS" subtitle="Prélèvement de la TPS par prestataire, par mois et par exercice" icon={Receipt} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block w-56">
            <div className={labelCls}>Prestataire</div>
            <Combobox
              options={assujettis}
              value={assujettis.find((p) => p.id === prestataireId) ?? null}
              onChange={(p) => setPrestataireId(p?.id ?? "")}
              getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
              allowClear clearLabel="Tous les prestataires assujettis"
            />
          </label>
          <label className="block">
            <div className={labelCls}>Exercice</div>
            <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={fieldCls}>
              <option value="">Tous (avec "Non réglé")</option>
              {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
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
          <Btn variant="ghost" onClick={() => openEtatTps(filtresActuels)}><Printer className="w-4 h-4" />Imprimer cet état</Btn>
          <Btn variant="ghost" onClick={() => openListePrestatairesTps()}><FileStack className="w-4 h-4" />Liste des prestataires assujettis</Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Détail par prestataire et par mois de règlement</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Montant TPS déjà calculé, réglé ou non — cliquez une ligne pour voir les factures concernées.</p>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {["", "Mois", "Prestataire", "Lignes", "Base remboursement", "TPS prélevée"].map((h) => (
                <th key={h} className="text-left text-[11px] text-muted-foreground font-semibold uppercase tracking-wide px-4 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lignes ?? []).map((l) => {
              const cle = `${l.prestataireId}-${l.mois}`;
              const estOuverte = ouvertes.has(cle);
              return (
                <Fragment key={cle}>
                  <tr onClick={() => toggle(cle)} className="border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground">{estOuverte ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.mois}</td>
                    <td className="px-4 py-2 font-semibold text-foreground whitespace-nowrap">{l.prestataireNom}</td>
                    <td className="px-4 py-2 text-center whitespace-nowrap text-foreground">{l.nbLignes}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.totalBaseRemboursement)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.totalTps)}</td>
                  </tr>
                  {estOuverte && (
                    <tr className="border-b border-border/50 bg-secondary/10">
                      <td colSpan={6} className="px-4 py-3">
                        <table className="w-full text-[12px] rounded-lg overflow-hidden border border-border/60">
                          <thead>
                            <tr className="border-b border-border/60 bg-secondary/30">
                              {["Date de soin", "Assuré", "Facture", "Frais réel", "Base remb.", "TPS prélevée"].map((h) => (
                                <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {l.lignes.map((d, i) => (
                              <tr key={`${cle}-${i}`} className="border-b border-border/40 last:border-0">
                                <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{d.date}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground">{d.assureNom}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{d.factureReference}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.montant)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.baseRemboursement)}</td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(d.montantTps)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {lignes && lignes.length > 0 && (
            <tfoot>
              <tr className="border-t border-border bg-secondary/20 font-semibold">
                <td className="px-4 py-2 text-foreground" colSpan={5}>TOTAL</td>
                <td className="px-4 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalTps)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {lignes && lignes.length === 0 && <div className="py-10 text-center text-muted-foreground text-sm">Aucune TPS pour ces critères.</div>}
        {!lignes && <div className="py-10 text-center text-muted-foreground text-sm">Chargement…</div>}
      </div>
    </div>
  );
}

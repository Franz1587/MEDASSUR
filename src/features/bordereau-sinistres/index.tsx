import { Fragment, useEffect, useState } from "react";
import { AlertTriangle, Printer, Search, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { fmtM } from "@/lib/format";
import { getBordereauSinistres, getVillesPrestatairesBordereau, SANS_AGENCE, type BordereauSinistresPayload, type GroupementBordereauSinistres, type TypeReglementBordereauSinistres } from "@/services/bordereaux.service";
import { getAgences } from "@/services/agences.service";
import type { Agence } from "@/types/agences";
import { openBordereauSinistres } from "@/services/documents.service";
import { getCompagnies } from "@/services/compagnies.service";
import type { Compagnie } from "@/types/compagnies";

const fieldCls = "border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// Bordereau Sinistres (2026-08) — voir demande utilisateur : "le bordereau
// sinistres se génère par compagnie" — c'est le document que le courtier
// adresse à UNE compagnie précise pour réclamer le renflouement du fonds de
// roulement (voir modèle fourni, toujours scopé à un seul destinataire),
// donc une compagnie doit être choisie avant de générer. Détail groupé par
// souscripteur au sein de cette compagnie (même structure que le modèle).
// Par agence (2026-09) — voir demande utilisateur : "générer les bordereaux
// par compagnie oui, mais par agence... en fonction des prestataires d'une
// ville et surtout de l'agence dans laquelle les factures ont été saisies" :
// filtres agence de saisie et ville du prestataire, regroupement par
// prestataire possible ; la compagnie devient facultative si une agence est
// choisie.
export default function BordereauSinistresView() {
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [compagnieId, setCompagnieId] = useState("");
  const [typeReglement, setTypeReglement] = useState<TypeReglementBordereauSinistres>("maladie");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [payload, setPayload] = useState<BordereauSinistresPayload | null>(null);
  const [recherchant, setRecherchant] = useState(false);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [agenceId, setAgenceId] = useState("");
  const [villes, setVilles] = useState<string[]>([]);
  const [ville, setVille] = useState("");
  const [groupement, setGroupement] = useState<GroupementBordereauSinistres>("souscripteur");

  useEffect(() => {
    getCompagnies().then(setCompagnies);
    getAgences().then(setAgences).catch(() => undefined);
    getVillesPrestatairesBordereau().then(setVilles).catch(() => undefined);
  }, []);

  const optionsAgence = [{ id: SANS_AGENCE, nom: "Sans agence (siège)" }, ...agences.map((a) => ({ id: a.id, nom: a.nom }))];
  const optionsVille = villes.map((v) => ({ id: v, nom: v }));
  const filtres = { agenceId: agenceId || undefined, ville: ville || undefined, groupement };
  const perimetreChoisi = !!compagnieId || !!agenceId;

  const handleRechercher = async () => {
    if (!perimetreChoisi) { toast.error("Choisissez une compagnie ou une agence."); return; }
    setRecherchant(true);
    try {
      setPayload(await getBordereauSinistres(du || undefined, au || undefined, compagnieId || undefined, typeReglement, filtres));
    } finally {
      setRecherchant(false);
    }
  };

  const nbLignes = (payload?.groupes ?? []).reduce((s, g) => s + g.lignes.length, 0);
  const libelleColReglement = typeReglement === "comptable" ? "N° Chèque" : "N° Règlement";

  return (
    <div className="p-6">
      <ModuleHeader title="Bordereau Sinistres" subtitle="Factures et remboursements réglés, par compagnie, par agence de saisie et par ville de prestataire — pour réclamation du fonds de roulement" icon={AlertTriangle} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block w-64">
            <div className={labelCls}>Compagnie{agenceId ? "" : " *"}</div>
            <Combobox
              options={compagnies}
              value={compagnies.find((c) => c.id === compagnieId) ?? null}
              onChange={(c) => { setCompagnieId(c?.id ?? ""); setPayload(null); }}
              getLabel={(c) => c.nom} getId={(c) => c.id}
              allowClear clearLabel="Toutes les compagnies"
              placeholder="Rechercher…"
            />
          </label>
          <label className="block w-56">
            <div className={labelCls}>Agence de saisie</div>
            <Combobox
              options={optionsAgence}
              value={optionsAgence.find((a) => a.id === agenceId) ?? null}
              onChange={(a) => { setAgenceId(a?.id ?? ""); setPayload(null); }}
              getLabel={(a) => a.nom} getId={(a) => a.id}
              allowClear clearLabel="Toutes les agences"
              placeholder="Toutes les agences"
            />
          </label>
          <label className="block w-48">
            <div className={labelCls}>Ville du prestataire</div>
            <Combobox
              options={optionsVille}
              value={optionsVille.find((v) => v.id === ville) ?? null}
              onChange={(v) => { setVille(v?.id ?? ""); setPayload(null); }}
              getLabel={(v) => v.nom} getId={(v) => v.id}
              allowClear clearLabel="Toutes les villes"
              placeholder="Toutes les villes"
            />
          </label>
          <label className="block">
            <div className={labelCls}>Regrouper par</div>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(["souscripteur", "prestataire"] as const).map((g, i) => (
                <button
                  key={g} type="button" onClick={() => { setGroupement(g); setPayload(null); }}
                  className={`px-3 py-2 text-[13px] ${i > 0 ? "border-l border-border" : ""} ${groupement === g ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  {g === "souscripteur" ? "Souscripteur" : "Prestataire"}
                </button>
              ))}
            </div>
          </label>
          <label className="block">
            <div className={labelCls}>Type de règlement</div>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button
                type="button" onClick={() => { setTypeReglement("maladie"); setPayload(null); }}
                className={`px-3 py-2 text-[13px] ${typeReglement === "maladie" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                Règlement Maladie
              </button>
              <button
                type="button" onClick={() => { setTypeReglement("comptable"); setPayload(null); }}
                className={`px-3 py-2 text-[13px] border-l border-border ${typeReglement === "comptable" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                Règlement Comptable
              </button>
            </div>
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
          <Btn variant="ghost" onClick={() => openBordereauSinistres(du || undefined, au || undefined, compagnieId || undefined, typeReglement, "pdf", filtres)} disabled={!perimetreChoisi}><Printer className="w-4 h-4" />Imprimer</Btn>
          <Btn variant="ghost" onClick={() => openBordereauSinistres(du || undefined, au || undefined, compagnieId || undefined, typeReglement, "xlsx", filtres)} disabled={!perimetreChoisi}><FileSpreadsheet className="w-4 h-4" />Excel</Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">{payload ? `${payload.groupes.length} ${payload.groupement === "prestataire" ? "prestataire(s)" : "souscripteur(s)"} — ${nbLignes} ligne(s)` : `Détail par ${groupement}`}</h3>
        </div>

        {!perimetreChoisi ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Choisissez une compagnie ou une agence puis lancez la recherche.</div>
        ) : !payload ? (
          <div className="py-10 text-center text-muted-foreground text-sm">{recherchant ? "Chargement…" : "Lancez la recherche pour afficher le détail."}</div>
        ) : payload.groupes.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">Aucun sinistre réglé pour ces critères.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  {["Date soins", "Date règlement", "N° Police", "Souscripteur", "N° client", "Assuré", "Prestataire", "Ville", "Agence de saisie", libelleColReglement, "Frais réels", "Part Garant", "TPS", "Net à payer"].map((h) => (
                    <th key={h} className="text-left text-[10.5px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.groupes.map((g) => (
                  <Fragment key={g.souscripteur}>
                    {g.lignes.map((l, i) => (
                      <tr key={`${g.souscripteur}-${i}`} className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.dateSoins}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.dateReglement}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.numeroPolice}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground">{l.souscripteur}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.numeroClient}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-foreground">{l.assurePrincipal}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-foreground">{l.prestataire}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.villePrestataire}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.agence}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.numeroReglement}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.fraisReels)}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.partGarant)}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.tps)}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.netAPayer)}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/10 font-semibold">
                      <td colSpan={10} className="px-3 py-1.5 text-foreground text-right">Sous Total {g.souscripteur}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.fraisReels)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.partGarant)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.tps)}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.totaux.netAPayer)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/40 font-bold">
                  <td colSpan={10} className="px-3 py-2 text-foreground text-right">TOTAL GÉNÉRAL</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(payload.total.fraisReels)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(payload.total.partGarant)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(payload.total.tps)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(payload.total.netAPayer)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

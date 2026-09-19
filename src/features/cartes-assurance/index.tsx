import { useEffect, useState } from "react";
import { CreditCard, Eye, Printer, Users, FolderInput, ClipboardCheck, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { getContrats } from "@/services/contrats.service";
import { getAssuresSante, assurePhotoUrl } from "@/services/sante.service";
import { openCarteAssurance, genererCartesEnMasse } from "@/services/documents.service";
import ImportDiffereModal from "./ImportDiffereModal";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const filtreCls = "h-8 w-full border border-border rounded-lg px-2 bg-background text-[12px] text-foreground";

// Une carte est "conforme" si toutes les informations qui y figurent sont
// disponibles — le téléphone est celui de la racine de famille (jamais
// propre à un CJ/EF), voir schema.prisma AssureSante (commentaire familleId).
const CHAMPS_CONFORMITE = ["photo", "téléphone", "date de naissance", "matricule", "numéro d'assuré"] as const;
type ChampManquant = typeof CHAMPS_CONFORMITE[number];

function champsManquants(a: AssureSante, racine: AssureSante | null): ChampManquant[] {
  const manques: ChampManquant[] = [];
  if (!a.photo) manques.push("photo");
  if (!racine?.telephone) manques.push("téléphone");
  if (!a.dateNaissance) manques.push("date de naissance");
  if (!a.matricule) manques.push("matricule");
  if (!a.numeroAssure) manques.push("numéro d'assuré");
  return manques;
}

// Chaque assuré (principal, conjoint, enfant — quel que soit l'âge) a sa
// propre carte imprimable au format CR80 (Evolis). Les cartes se génèrent
// individuellement (aperçu avant impression), par sélection (ex: une
// famille — pas de lien de famille strict en base, donc sélection manuelle
// groupée visuellement par nom), ou pour tout le contrat en un clic — ce
// dernier mode reste performant pour 20 000+ assurés car la génération est
// entièrement streamée côté serveur (voir DocumentsService.renderCartesEnMasse).
export default function CartesAssuranceView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratId, setContratId] = useState("");
  const [population, setPopulation] = useState<AssureSante[]>([]);
  const [loadingPopulation, setLoadingPopulation] = useState(false);
  const [filtreNom, setFiltreNom] = useState("");
  const [filtreFamille, setFiltreFamille] = useState("");
  const [filtreMatricule, setFiltreMatricule] = useState("");
  const [filtreTelephone, setFiltreTelephone] = useState("");
  const [filtrePhoto, setFiltrePhoto] = useState<"tous" | "avec" | "sans">("tous");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showImportDiffere, setShowImportDiffere] = useState(false);

  useEffect(() => {
    getContrats().then(setContrats);
  }, []);

  const refreshPopulation = () => {
    if (!contratId) { setPopulation([]); return; }
    setLoadingPopulation(true);
    getAssuresSante()
      .then((all) => setPopulation(all.filter((a) => a.police === contratId && a.statut !== "Radié")))
      .finally(() => setLoadingPopulation(false));
  };

  useEffect(() => {
    setSelected([]);
    setFiltreNom(""); setFiltreFamille(""); setFiltreMatricule(""); setFiltreTelephone(""); setFiltrePhoto("tous");
    refreshPopulation();
  }, [contratId]);

  const contrat = contrats.find((c) => c.id === contratId);
  const racineDe = (a: AssureSante) => (a.familleId ? population.find((x) => x.id === a.familleId) ?? null : a);

  // Rang au sein d'une famille : assuré principal, puis conjoint(e), puis
  // enfants — ces derniers du plus âgé (date de naissance la plus ancienne)
  // au plus jeune. Même règle que côté génération PDF (voir
  // backend/src/documents/documents.service.ts, ordonnerParFamille) : le
  // classement à l'écran doit refléter l'ordre physique des cartes produites.
  const RANG_TYPE: Record<string, number> = { AS: 0, CJ: 1, EF: 2 };
  const timestampNaissance = (d?: string) => {
    const m = d ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d) : null;
    if (!m) return Infinity;
    const [, j, mo, a] = m;
    return new Date(Number(a), Number(mo) - 1, Number(j)).getTime();
  };
  const rangerParFamille = (liste: AssureSante[]) =>
    [...liste].sort((x, y) => {
      const cx = racineDe(x)?.id ?? x.id;
      const cy = racineDe(y)?.id ?? y.id;
      if (cx !== cy) return cx.localeCompare(cy);
      const rx = RANG_TYPE[x.typeAssure ?? "EF"] ?? 2;
      const ry = RANG_TYPE[y.typeAssure ?? "EF"] ?? 2;
      if (rx !== ry) return rx - ry;
      return timestampNaissance(x.dateNaissance) - timestampNaissance(y.dateNaissance);
    });

  const filtered = rangerParFamille(population.filter((a) => {
    const racine = racineDe(a);
    if (filtreNom.trim() && !`${a.nom} ${a.prenom ?? ""}`.toLowerCase().includes(filtreNom.trim().toLowerCase())) return false;
    if (filtreFamille.trim() && !(racine?.nom ?? "").toLowerCase().includes(filtreFamille.trim().toLowerCase())) return false;
    if (filtreMatricule.trim() && !a.matricule.toLowerCase().includes(filtreMatricule.trim().toLowerCase())) return false;
    if (filtreTelephone.trim() && !(racine?.telephone ?? "").toLowerCase().includes(filtreTelephone.trim().toLowerCase())) return false;
    if (filtrePhoto === "avec" && !a.photo) return false;
    if (filtrePhoto === "sans" && a.photo) return false;
    return true;
  }));
  const visible = filtered.slice(0, 300);
  const toutSelectionne = filtered.length > 0 && filtered.every((a) => selected.includes(a.id));
  const toggleTout = () => setSelected(toutSelectionne ? [] : filtered.map((a) => a.id));

  // Reporting de conformité — recalculé en direct sur la sélection filtrée,
  // sans appel serveur supplémentaire (tout dérive de la population déjà chargée).
  const rapport = filtered.map((a) => ({ a, manques: champsManquants(a, racineDe(a)) }));
  const nbConforme = rapport.filter((r) => r.manques.length === 0).length;
  const nbIncomplet = rapport.length - nbConforme;
  const manquesParChamp = Object.fromEntries(CHAMPS_CONFORMITE.map((c) => [c, rapport.filter((r) => r.manques.includes(c)).length])) as Record<ChampManquant, number>;

  const toggle = (id: string) => {
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const handleApercu = async (assureId: string) => {
    try {
      await openCarteAssurance(assureId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aperçu impossible.");
    }
  };

  const handleGenererSelection = async () => {
    if (selected.length === 0) return;
    try {
      setBusy(true);
      await genererCartesEnMasse({ assureIds: selected });
      toast.success(`${selected.length} carte(s) générée(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleGenererContrat = async () => {
    if (!contratId) return;
    const ok = window.confirm(`Générer les cartes de tous les assurés actifs de ${contratId} (${population.length}+) ?`);
    if (!ok) return;
    try {
      setBusy(true);
      await genererCartesEnMasse({ contratId });
      toast.success("Cartes générées pour tout le contrat.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Cartes d'assurance"
        subtitle="Génération de cartes personnelles (recto/verso, format CR80) — individuellement, par sélection, ou pour tout un contrat"
        icon={CreditCard}
        actions={<Btn variant="secondary" onClick={() => setShowImportDiffere(true)}><FolderInput className="w-4 h-4" />Import différé (photos/téléphones)</Btn>}
      />

      {showImportDiffere && (
        <ImportDiffereModal onClose={() => setShowImportDiffere(false)} onImported={refreshPopulation} />
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block max-w-md">
          <div className="text-[12px] text-muted-foreground mb-1.5">Contrat</div>
          <Combobox
            options={contrats}
            value={contrats.find((c) => c.id === contratId) ?? null}
            onChange={(c) => setContratId(c?.id ?? "")}
            getLabel={(c) => c.numeroPolice ?? c.id} getSubLabel={(c) => c.client} getId={(c) => c.id}
            placeholder="Rechercher un contrat…"
          />
        </label>
      </div>

      {contratId && (
        <>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">{contrat?.client} — {population.length} assuré(s) actif(s)</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input value={filtreNom} onChange={(e) => setFiltreNom(e.target.value)} placeholder="Nom…" className={filtreCls} />
              <input value={filtreFamille} onChange={(e) => setFiltreFamille(e.target.value)} placeholder="Famille…" className={filtreCls} />
              <input value={filtreMatricule} onChange={(e) => setFiltreMatricule(e.target.value)} placeholder="Matricule…" className={filtreCls} />
              <input value={filtreTelephone} onChange={(e) => setFiltreTelephone(e.target.value)} placeholder="Téléphone…" className={filtreCls} />
              <select value={filtrePhoto} onChange={(e) => setFiltrePhoto(e.target.value as typeof filtrePhoto)} className={filtreCls}>
                <option value="tous">Photo : tous</option>
                <option value="avec">Avec photo uniquement</option>
                <option value="sans">Sans photo uniquement</option>
              </select>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">Conformité des cartes ({rapport.length} sélectionné{rapport.length > 1 ? "s" : ""})</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-secondary/30 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Conformes</p>
                <p className="text-[18px] font-semibold text-foreground">{nbConforme}</p>
              </div>
              <div className="rounded-lg bg-secondary/30 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">Incomplètes</p>
                <p className="text-[18px] font-semibold text-foreground">{nbIncomplet}</p>
              </div>
              {CHAMPS_CONFORMITE.map((champ) => (
                <div key={champ} className="rounded-lg bg-secondary/30 px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground capitalize">Sans {champ}</p>
                  <p className="text-[15px] font-semibold text-foreground">{manquesParChamp[champ]}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} disabled={filtered.length === 0} />
                {filtered.length} résultat(s) — tout {toutSelectionne ? "désélectionner" : "sélectionner"}
              </label>
              <div className="flex items-center gap-2">
                <Btn variant="secondary" disabled={busy || selected.length === 0} onClick={handleGenererSelection}><Printer className="w-4 h-4" />Générer la sélection ({selected.length})</Btn>
                <Btn variant="primary" disabled={busy || population.length === 0} onClick={handleGenererContrat}><Printer className="w-4 h-4" />Générer tout le contrat</Btn>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-y-auto divide-y divide-border/50">
              {loadingPopulation && <p className="text-[12px] text-muted-foreground text-center py-8">Chargement…</p>}
              {!loadingPopulation && visible.length === 0 && (
                <p className="text-[12px] text-muted-foreground text-center py-8">Aucun résultat pour ces filtres.</p>
              )}
              {visible.map((a) => {
                const manques = champsManquants(a, racineDe(a));
                return (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2 hover:bg-secondary/30 transition-colors">
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="flex-shrink-0" />
                      {assurePhotoUrl(a.photo)
                        ? <img src={assurePhotoUrl(a.photo)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center flex-shrink-0"><ImageOff className="w-3.5 h-3.5 text-muted-foreground" /></div>}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{a.nom} {a.prenom ?? ""}</p>
                        <p className="text-[11px] text-muted-foreground">{a.matricule} · {a.typeAssure ?? "—"}</p>
                      </div>
                    </label>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {manques.length === 0
                        ? <Badge variant="success">Conforme</Badge>
                        : <Badge variant="warning">{manques.length} manque{manques.length > 1 ? "s" : ""}</Badge>}
                      <button type="button" onClick={() => handleApercu(a.id)} className="h-8 px-3 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />Aperçu
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > 300 && (
              <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border">Affichage limité aux 300 premiers résultats ({filtered.length} au total) — affinez les filtres, ou utilisez "Générer tout le contrat" pour la population complète.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

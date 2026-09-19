import { useEffect, useMemo, useState } from "react";
import { Search, X, FileStack } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { getPrestataires } from "@/services/prestataires.service";
import { getCompagnies } from "@/services/compagnies.service";
import { getClients } from "@/services/clients.service";
import { getFacturesEligiblesReglement, genererBordereau } from "@/services/reglement.service";
import { getMedecins, type Medecin } from "@/services/medecins.service";
import type { Prestataire } from "@/types/prestataires";
import type { Compagnie } from "@/types/compagnies";
import type { Client } from "@/types/clients";
import type { FactureEligibleReglement } from "@/types/reglement";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function GenererReglementModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [clientsDisponibles, setClientsDisponibles] = useState<Client[]>([]);

  const [prestataireId, setPrestataireId] = useState("");
  const [compagnieId, setCompagnieId] = useState("");
  const [clientId, setClientId] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  // Règlement à l'ordre d'un médecin (2026-08) — voir demande utilisateur :
  // "lorsqu'on fait un règlement pour une structure médicale, que le
  // règlement se fasse à l'ordre d'un médecin intervenant dans la
  // structure" — liste scopée aux médecins réellement liés à cette
  // structure (voir GET /medecins?prestataireId).
  const [medecinsStructure, setMedecinsStructure] = useState<Medecin[]>([]);
  const [medecinId, setMedecinId] = useState("");

  const [resultats, setResultats] = useState<FactureEligibleReglement[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getPrestataires().then((data) => { setPrestataires(data); setPrestataireId((id) => id || data[0]?.id || ""); });
    getCompagnies().then(setCompagnies);
  }, []);

  // Liste des médecins de la structure choisie (2026-08) — réinitialisée
  // dès que le prestataire change, un médecin d'une autre structure n'a
  // pas de sens ici (voir demande utilisateur ci-dessus).
  useEffect(() => {
    setMedecinId("");
    if (!prestataireId) { setMedecinsStructure([]); return; }
    getMedecins({ prestataireId }).then(setMedecinsStructure);
  }, [prestataireId]);

  // Filtre dépendant Compagnie -> Souscripteur : ne fait remonter que les
  // clients réellement liés à la compagnie sélectionnée (voir
  // ClientsService.findAll).
  useEffect(() => {
    if (!compagnieId) { setClientsDisponibles([]); setClientId(""); return; }
    getClients(compagnieId).then((data) => {
      setClientsDisponibles(data);
      setClientId((id) => (data.some((c) => c.id === id) ? id : ""));
    });
  }, [compagnieId]);

  // Change un critère après une recherche déjà lancée -> les résultats
  // affichés (et les cases cochées) ne correspondent plus au filtre actuel.
  // Sans ce reset, "Générer" pouvait envoyer le prestataireId nouvellement
  // choisi avec des factureIds issus de l'ancienne recherche (un autre
  // prestataire) — le backend les rejette alors en bloc avec un message peu
  // clair ("Aucune prise en charge non réglée pour les factures
  // sélectionnées."), sans indice que la cause est un filtre changé entre
  // la recherche et la génération.
  useEffect(() => {
    setResultats(null);
    setSelected([]);
  }, [prestataireId, compagnieId, clientId, du, au]);

  const handleRechercher = async () => {
    if (!prestataireId) { toast.error("Choisissez un prestataire."); return; }
    setSearching(true);
    try {
      const data = await getFacturesEligiblesReglement({ prestataireId, compagnieId: compagnieId || undefined, clientId: clientId || undefined, du: du || undefined, au: au || undefined });
      setResultats(data);
      setSelected(data.map((f) => f.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setSearching(false);
    }
  };

  const toutSelectionne = resultats !== null && resultats.length > 0 && resultats.every((f) => selected.includes(f.id));
  const toggleTout = () => setSelected(toutSelectionne ? [] : (resultats ?? []).map((f) => f.id));
  const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const totalSelectionne = useMemo(
    () => (resultats ?? []).filter((f) => selected.includes(f.id)).reduce((s, f) => s + f.montant, 0),
    [resultats, selected],
  );

  const handleGenerer = async () => {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      await genererBordereau({ prestataireId, factureIds: selected, medecinId: medecinId || undefined });
      toast.success("Règlement généré.");
      onGenerated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><FileStack className="w-4 h-4 text-primary" />Générer un règlement</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <label className="block">
              <div className={labelCls}>Prestataire *</div>
              <Combobox
                options={prestataires}
                value={prestataires.find((p) => p.id === prestataireId) ?? null}
                onChange={(p) => setPrestataireId(p?.id ?? "")}
                getLabel={(p) => p.nom} getSubLabel={(p) => p.ville} getId={(p) => p.id}
                placeholder="Rechercher…"
              />
            </label>
            <label className="block">
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
              <div className={labelCls}>Souscripteur</div>
              <Combobox
                options={clientsDisponibles}
                value={clientsDisponibles.find((c) => c.id === clientId) ?? null}
                onChange={(c) => setClientId(c?.id ?? "")}
                getLabel={(c) => c.nom} getId={(c) => c.id}
                disabled={!compagnieId}
                allowClear clearLabel="Tous"
                placeholder={compagnieId ? undefined : "Choisir une compagnie d'abord"}
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
          </div>

          {medecinsStructure.length > 0 && (
            <label className="block max-w-sm">
              <div className={labelCls}>Établir le règlement à l'ordre de</div>
              <Combobox
                options={medecinsStructure}
                value={medecinsStructure.find((m) => m.id === medecinId) ?? null}
                onChange={(m) => setMedecinId(m?.id ?? "")}
                getLabel={(m) => `${m.titre ? `${m.titre} ` : ""}${m.nom}${m.prenom ? ` ${m.prenom}` : ""}`}
                getSubLabel={(m) => m.specialite ?? ""} getId={(m) => m.id}
                allowClear clearLabel="La structure elle-même"
                placeholder="Rechercher un médecin de cette structure…"
              />
            </label>
          )}

          <Btn variant="primary" onClick={handleRechercher} disabled={searching}><Search className="w-4 h-4" />{searching ? "Recherche…" : "Rechercher"}</Btn>

          {resultats !== null && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/20 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={toutSelectionne} onChange={toggleTout} disabled={resultats.length === 0} className="w-3.5 h-3.5 accent-primary" />
                  Tout sélectionner ({resultats.length} facture{resultats.length > 1 ? "s" : ""})
                </label>
                <span className="text-[11px] text-muted-foreground">{selected.length} sélectionnée{selected.length > 1 ? "s" : ""} — {fmtM(totalSelectionne)} FCFA</span>
              </div>
              {resultats.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Aucune facture non réglée pour ces critères.</div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                  {resultats.map((f) => (
                    <label key={f.id} className="flex items-center gap-3 px-3 py-2 text-[12px] cursor-pointer hover:bg-secondary/30">
                      <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} className="w-3.5 h-3.5 accent-primary flex-shrink-0" />
                      <span className="flex-1 font-semibold text-foreground">{f.referenceFacture}{f.numerosSupplementaires.length > 0 && <span className="text-muted-foreground font-normal"> +{f.numerosSupplementaires.length}</span>}</span>
                      <span className="w-40 text-muted-foreground truncate">{f.clientNom}</span>
                      <span className="w-32 text-muted-foreground truncate">{f.compagnieNom}</span>
                      <span className="w-24 text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f.dateReception}</span>
                      <span className="w-16 text-center text-muted-foreground">{f.nbLignes} l.</span>
                      <span className="w-28 text-right font-semibold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(f.montant)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <Btn variant="primary" onClick={handleGenerer} disabled={generating || selected.length === 0}>
            {generating ? "Génération…" : `Générer le règlement (${selected.length})`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

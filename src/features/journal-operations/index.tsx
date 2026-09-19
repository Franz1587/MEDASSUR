import { useEffect, useState } from "react";
import { History, Search, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { getJournalOperations, openEtatGlobalJournal } from "@/services/audit.service";
import { getUsers } from "@/services/admin.service";
import { roles } from "@/auth/roles";
import type { AuditLogEntry } from "@/types/audit";
import type { UserAccount } from "@/types/admin";

// Libellés lisibles des entités journalisées (2026-08) — la valeur brute
// est le premier segment de route après /api (voir AuditInterceptor),
// donc le nom du contrôleur Nest concerné ; cette liste ne bloque pas la
// recherche, elle la guide (voir Combobox allowClear).
const ENTITES = [
  { id: "contrats", libelle: "Contrats" },
  { id: "factures", libelle: "Factures" },
  { id: "accord-prealable", libelle: "Prises en charge" },
  { id: "reglement-prestataire", libelle: "Règlement prestataire" },
  { id: "reglement-comptable", libelle: "Règlement comptable" },
  { id: "clients", libelle: "Souscripteurs" },
  { id: "sante", libelle: "Participants santé" },
  { id: "avenants", libelle: "Avenants" },
  { id: "renouvellements", libelle: "Renouvellements" },
  { id: "resiliations", libelle: "Résiliations" },
  { id: "sinistres", libelle: "Sinistres" },
  { id: "prestataires", libelle: "Prestataires" },
  { id: "actes-medicaux", libelle: "Catalogue des actes médicaux" },
  { id: "lettres-cles", libelle: "Lettres clés" },
  { id: "devis", libelle: "Devis" },
  { id: "cotation", libelle: "Cotation" },
  { id: "appel-offres", libelle: "Appels d'offres" },
];
const ACTIONS = [
  { id: "Créé", libelle: "Créé" },
  { id: "Modifié", libelle: "Modifié" },
  { id: "Clôturé", libelle: "Clôturé / Supprimé" },
];

const actionVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "Créé": "success", "Modifié": "warning", "Clôturé": "danger",
};

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function JournalOperationsView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [entite, setEntite] = useState("");
  const [action, setAction] = useState("");
  const [entiteId, setEntiteId] = useState("");
  const [utilisateur, setUtilisateur] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherchant, setRecherchant] = useState(false);
  // Agents (2026-08) — voir demande utilisateur : "on doit pouvoir...
  // filtrer... par agents." Seuls les comptes INTERNES (voir roles.ts,
  // family "interne") ont vocation à apparaître ici — un compte externe
  // (assuré, prestataire...) qui laisse une trace dans le journal (ex. dépôt
  // d'un devis) n'est pas un "agent" au sens de ce filtre.
  const [agents, setAgents] = useState<UserAccount[]>([]);
  useEffect(() => { getUsers().then((us) => setAgents(us.filter((u) => roles[u.roleId]?.family === "interne"))).catch(() => undefined); }, []);

  const filtresActuels = () => ({
    entite: entite || undefined, action: action || undefined, entiteId: entiteId.trim() || undefined,
    utilisateur: utilisateur || undefined, du: du || undefined, au: au || undefined,
  });

  const handleRechercher = async () => {
    setRecherchant(true);
    try {
      setEntries(await getJournalOperations(filtresActuels()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recherche impossible.");
    } finally {
      setRecherchant(false);
    }
  };

  // État global — édition/téléchargement/impression (2026-08) — voir
  // demande utilisateur : "on doit pouvoir en éditer, télécharger et
  // imprimer un état global, par type d'action, par date, mais aussi par
  // agents." Mêmes filtres que la recherche à l'écran ci-dessus — l'état
  // global reflète toujours ce que l'agent est en train de consulter.
  const [generation, setGeneration] = useState<"pdf" | "xlsx" | null>(null);
  const handleEtatGlobal = async (format: "pdf" | "xlsx") => {
    setGeneration(format);
    try {
      await openEtatGlobalJournal(filtresActuels(), format);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setGeneration(null);
    }
  };

  useEffect(() => { handleRechercher(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Journal des opérations"
        subtitle="Traçabilité de toute création, modification ou clôture enregistrée dans l'application — qui, quoi, quand. Une simple consultation (ouverture d'une fiche) n'est jamais journalisée ici."
        icon={History}
        actions={
          <>
            <Btn variant="secondary" disabled={generation !== null} onClick={() => handleEtatGlobal("xlsx")}>
              <FileDown className="w-4 h-4" />{generation === "xlsx" ? "Génération…" : "Télécharger l'état global"}
            </Btn>
            <Btn variant="primary" disabled={generation !== null} onClick={() => handleEtatGlobal("pdf")}>
              <Printer className="w-4 h-4" />{generation === "pdf" ? "Génération…" : "Imprimer l'état global"}
            </Btn>
          </>
        }
      />

      <div className="bg-card border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Rechercher dans le journal</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <label className="block">
              <div className={labelCls}>Entité</div>
              <Combobox
                options={ENTITES}
                value={ENTITES.find((e) => e.id === entite) ?? null}
                onChange={(e) => setEntite(e?.id ?? "")}
                getLabel={(e) => e.libelle} getId={(e) => e.id}
                allowClear clearLabel="Toutes"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Action</div>
              <Combobox
                options={ACTIONS}
                value={ACTIONS.find((a) => a.id === action) ?? null}
                onChange={(a) => setAction(a?.id ?? "")}
                getLabel={(a) => a.libelle} getId={(a) => a.id}
                allowClear clearLabel="Toutes"
              />
            </label>
            <label className="block">
              <div className={labelCls}>Agent</div>
              <Combobox
                options={agents}
                value={agents.find((u) => u.email === utilisateur) ?? null}
                onChange={(u) => setUtilisateur(u?.email ?? "")}
                getLabel={(u) => u.nom} getSubLabel={(u) => u.email} getId={(u) => u.id}
                allowClear clearLabel="Tous"
              />
            </label>
            <label className="block">
              <div className={labelCls}>N° dossier</div>
              <input value={entiteId} onChange={(e) => setEntiteId(e.target.value)} placeholder="ex: CTR-2026-… ou FAC-2026-…" className={fieldCls} />
            </label>
            <label className="block"><div className={labelCls}>Du</div><DateInput value={du} onChange={setDu} className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Au</div><DateInput value={au} onChange={setAu} className={fieldCls} /></label>
          </div>
          <Btn variant="primary" onClick={handleRechercher} disabled={recherchant}>
            <Search className="w-4 h-4" />{recherchant ? "Recherche…" : "Rechercher"}
          </Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Utilisateur", "Entité", "Dossier", "Action", "Détails"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{new Date(e.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{e.utilisateurNom}</td>
                <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{ENTITES.find((x) => x.id === e.entite)?.libelle ?? e.entite}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{e.entiteId}</td>
                <td className="px-4 py-2.5 whitespace-nowrap"><Badge variant={actionVariant[e.action] ?? "neutral"}>{e.action}</Badge></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{e.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucune opération ne correspond à cette recherche.</div>}
      </div>
    </div>
  );
}

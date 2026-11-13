import { useEffect, useState } from "react";
import { ShieldCheck, Search, X, FileDown, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Pager } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getConsentements, type ConsentementRecord } from "@/services/admin.service";
import { openDocument } from "@/services/documents.service";
import { roleList } from "@/auth/roles";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ConsentementsView() {
  const [tous, setTous] = useState<ConsentementRecord[] | null>(null);
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("");
  const [telechargement, setTelechargement] = useState<string | null>(null);

  const charger = () => {
    setTous(null);
    getConsentements({ q: q.trim() || undefined, roleId: roleId || undefined })
      .then(setTous)
      .catch(() => { setTous([]); toast.error("Impossible de charger les consentements."); });
  };

  useEffect(() => { charger(); }, [q, roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pag = usePagination(tous ?? [], 25);

  const telecharger = async (id: string) => {
    setTelechargement(id);
    try {
      await openDocument(`/users/${id}/attestation-consentement`);
    } catch {
      toast.error("Génération de l'attestation impossible.");
    } finally {
      setTelechargement(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        icon={ShieldCheck}
        title="Consentement & Protection des données"
        subtitle="Liste des utilisateurs ayant accepté la politique de confidentialité"
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); pag.setPage(1); }}
            placeholder="Rechercher nom ou email…"
            className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground"
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); pag.setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={roleId}
          onChange={(e) => { setRoleId(e.target.value); pag.setPage(1); }}
          className="h-9 border border-border rounded-lg px-3 bg-background text-[13px] text-foreground"
        >
          <option value="">Tous les rôles</option>
          {roleList.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          {tous === null ? "…" : `${tous.length} utilisateur${tous.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Tableau */}
      {tous === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : tous.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun utilisateur ne correspond aux critères.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-secondary/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Utilisateur</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rôle</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Société</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date d'acceptation</span>
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Attestation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pag.pageItems.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{u.nom}</p>
                    <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {roleList.find((r) => r.id === u.roleId)?.label ?? u.roleId}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {u.societe?.nom ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {formatDate(u.consentementAccepteAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => telecharger(u.id)}
                      disabled={telechargement === u.id}
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border text-[11.5px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      {telechargement === u.id ? "…" : "PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager p={pag} />
    </div>
  );
}

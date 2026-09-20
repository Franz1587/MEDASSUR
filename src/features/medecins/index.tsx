import { useEffect, useState } from "react";
import { Stethoscope, Plus, Search, Pencil, Trash2, Building2, Power } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getMedecins, updateMedecin, supprimerMedecin, type Medecin } from "@/services/medecins.service";
import MedecinForm from "./MedecinForm";

// Professionnel de santé (2026-08) — voir demande utilisateur : "il faut à
// présent rendre possible l'ajout d'un médecin et sa spécialité dans le
// prestataire. En faire dans la rubrique 'Système', il faut créer un
// onglet professionnel de santé. C'est ici que l'on pourra créer des
// médecins, puis les lier à une clinique, hôpital... car un même médecin
// peut faire des prestations dans plusieurs structures médicales."
export default function ProfessionnelsSanteView() {
  const [medecins, setMedecins] = useState<Medecin[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [medecinEnEdition, setMedecinEnEdition] = useState<Medecin | null>(null);
  const pagination = usePagination(medecins ?? []);

  const rafraichir = (q?: string) => getMedecins(q !== undefined ? { q } : undefined).then(setMedecins);
  useEffect(() => { rafraichir(); }, []);

  useEffect(() => {
    const id = setTimeout(() => rafraichir(recherche.trim() || undefined), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const ouvrirCreation = () => { setMedecinEnEdition(null); setFormOuvert(true); };
  const ouvrirEdition = (m: Medecin) => { setMedecinEnEdition(m); setFormOuvert(true); };

  const toggleActif = async (m: Medecin) => {
    try {
      await updateMedecin(m.id, { actif: !m.actif });
      rafraichir(recherche.trim() || undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mise à jour impossible.");
    }
  };

  const supprimer = async (m: Medecin) => {
    if (!window.confirm(`Supprimer ${m.nom} ?`)) return;
    try {
      await supprimerMedecin(m.id);
      toast.success("Médecin supprimé.");
      rafraichir(recherche.trim() || undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" />Professionnel de santé</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">Médecins, leur spécialité, leur code praticien, et les structures où ils interviennent.</p>
        </div>
        <button type="button" onClick={ouvrirCreation} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" />Nouveau médecin
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un nom, une spécialité, un code praticien…"
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
      </div>

      {!medecins ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : medecins.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun médecin enregistré.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {["Médecin", "Spécialité", "Code praticien", "Téléphone", "Structures", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/15">
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-foreground">{m.titre ? `${m.titre} ` : ""}{m.nom}{m.prenom ? ` ${m.prenom}` : ""}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground">{m.specialite ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{m.codePraticien ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-foreground">{m.telephone ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {m.structures.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.structures.map((s) => (
                          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/40 text-[11px] text-foreground">
                            <Building2 className="w-3 h-3" />{s.nom}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Badge variant={m.actif ? "success" : "neutral"}>{m.actif ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <button type="button" onClick={() => toggleActif(m)} title={m.actif ? "Désactiver" : "Activer"} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md">
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => ouvrirEdition(m)} title="Modifier" className="p-1.5 text-muted-foreground hover:text-primary rounded-md">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => supprimer(m)} title="Supprimer" className="p-1.5 text-muted-foreground hover:text-destructive rounded-md">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
            onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}

      {formOuvert && (
        <MedecinForm
          medecin={medecinEnEdition}
          onClose={() => setFormOuvert(false)}
          onSaved={() => rafraichir(recherche.trim() || undefined)}
        />
      )}
    </div>
  );
}

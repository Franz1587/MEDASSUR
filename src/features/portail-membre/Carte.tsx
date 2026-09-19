import { useEffect, useState } from "react";
import { IdCard, Eye } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { getMoi, getMaFamille, openCarteDe, type MembreIdentite, type MembreFamilleMembre } from "@/services/portailMembre.service";
import { assurePhotoUrl } from "@/services/sante.service";

const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint(e)", EF: "Enfant" };

// Ma carte (2026-08) — voir demande utilisateur : "il faut les cartes de
// toute la famille" — liste l'assuré principal ET ses ayants droit, chacun
// avec sa propre carte réelle (DocumentsService.renderCarteUnique), ouverte
// dans la même visionneuse que côté interne — pas de reconstitution
// visuelle maison (voir demande utilisateur précédente : "faire remonter
// le vrai modèle de carte déjà existante côté assurance").
export default function MembreCarteView() {
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [famille, setFamille] = useState<MembreFamilleMembre[] | null>(null);
  const [ouverture, setOuverture] = useState<string | null>(null);

  useEffect(() => {
    getMoi().then(setMoi);
    getMaFamille().then(setFamille);
  }, []);

  const ouvrir = async (id: string) => {
    setOuverture(id);
    try {
      await openCarteDe(id);
    } finally {
      setOuverture(null);
    }
  };

  const personnes = [
    ...(moi ? [{ id: moi.id, nom: moi.nom, prenom: moi.prenom, typeAssure: "AS", statutCarte: moi.statutCarte, matricule: moi.matricule, photo: moi.photo }] : []),
    ...(famille ?? []).map((m) => ({ id: m.id, nom: m.nom, prenom: m.prenom, typeAssure: m.typeAssure, statutCarte: m.statutCarte, matricule: m.matricule, photo: m.photo })),
  ];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Ma carte</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Vous et vos ayants droit</p>
      </div>

      {!moi ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {personnes.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {assurePhotoUrl(p.photo)
                  ? <img src={assurePhotoUrl(p.photo)} alt="" className="w-full h-full object-cover" />
                  : <IdCard className="w-5 h-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground truncate">{p.nom} {p.prenom ?? ""}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{LABEL_TYPE[p.typeAssure ?? ""] ?? p.typeAssure ?? "—"}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={p.statutCarte === "Active" ? "success" : "warning"}>{p.statutCarte ?? "—"}</Badge>
                  <button
                    type="button"
                    onClick={() => ouvrir(p.id)}
                    disabled={ouverture === p.id}
                    className="text-[11.5px] text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-60"
                  >
                    <Eye className="w-3 h-3" />
                    {ouverture === p.id ? "Ouverture…" : "Voir la carte"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

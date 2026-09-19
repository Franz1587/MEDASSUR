import { useEffect, useState } from "react";
import { Users2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { getMoi, getMaFamille, type MembreIdentite, type MembreFamilleMembre } from "@/services/portailMembre.service";
import { assurePhotoUrl } from "@/services/sante.service";

const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint(e)", EF: "Enfant" };

type Membre = MembreFamilleMembre & { typeAssure: string | null };

// Ma famille (2026-08) — voir demande utilisateur : "faire aussi remonter
// les photos ici. Permettre aussi que l'assuré principal remonte ici. Il
// doit pouvoir voir le détail de chacun des membres de sa famille y compris
// lui-même." Liste désormais l'assuré principal ET ses ayants droit
// (comme Carte.tsx), avec photo réelle et un détail dépliable par membre.
export default function MembreFamilleView() {
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [membres, setMembres] = useState<MembreFamilleMembre[] | null>(null);
  const [detailOuvert, setDetailOuvert] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMoi().then(setMoi);
    getMaFamille().then(setMembres);
  }, []);

  const basculerDetail = (id: string) => {
    setDetailOuvert((v) => {
      const s = new Set(v);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const personnes: Membre[] | null = moi && membres
    ? [
        {
          id: moi.id, nom: moi.nom, prenom: moi.prenom, matricule: moi.matricule, typeAssure: "AS",
          dateNaissance: moi.dateNaissance, statut: "Actif", statutCarte: moi.statutCarte, photo: moi.photo,
          telephone: moi.telephone, email: moi.email, sexe: moi.sexe, adresse: moi.adresse,
          dateAffiliation: moi.dateAffiliation, nationalite: moi.nationalite, lieuNaissance: moi.lieuNaissance,
        },
        ...membres,
      ]
    : null;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Ma famille</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Vous et vos ayants droit rattachés à ce contrat</p>
      </div>

      {!personnes ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : (
        <div className="space-y-2.5">
          {personnes.map((m) => {
            const ouvert = detailOuvert.has(m.id);
            return (
              <div key={m.id} className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {assurePhotoUrl(m.photo)
                      ? <img src={assurePhotoUrl(m.photo)} alt="" className="w-full h-full object-cover" />
                      : <Users2 className="w-4.5 h-4.5 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">{m.nom} {m.prenom ?? ""}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">{LABEL_TYPE[m.typeAssure ?? ""] ?? m.typeAssure ?? "—"} · Né(e) le {m.dateNaissance ?? "—"}</p>
                  </div>
                  <Badge variant={m.statut === "Actif" ? "success" : "neutral"}>{m.statut}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => basculerDetail(m.id)}
                  className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {ouvert ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {ouvert ? "Masquer le détail" : "Voir le détail"}
                </button>
                {ouvert && (
                  <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                    <span className="text-muted-foreground">Matricule</span>
                    <span className="text-foreground text-right">{m.matricule}</span>
                    <span className="text-muted-foreground">Statut carte</span>
                    <span className="text-foreground text-right">{m.statutCarte ?? "—"}</span>
                    {m.telephone && (<><span className="text-muted-foreground">Téléphone</span><span className="text-foreground text-right">{m.telephone}</span></>)}
                    {m.email && (<><span className="text-muted-foreground">Email</span><span className="text-foreground text-right">{m.email}</span></>)}
                    {m.sexe && (<><span className="text-muted-foreground">Sexe</span><span className="text-foreground text-right">{m.sexe}</span></>)}
                    {m.adresse && (<><span className="text-muted-foreground">Adresse</span><span className="text-foreground text-right">{m.adresse}</span></>)}
                    {m.lieuNaissance && (<><span className="text-muted-foreground">Lieu de naissance</span><span className="text-foreground text-right">{m.lieuNaissance}</span></>)}
                    {m.nationalite && (<><span className="text-muted-foreground">Nationalité</span><span className="text-foreground text-right">{m.nationalite}</span></>)}
                    {m.dateAffiliation && (<><span className="text-muted-foreground">Affilié(e) depuis</span><span className="text-foreground text-right">{m.dateAffiliation}</span></>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

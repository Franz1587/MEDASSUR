import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Eye, User, Download, Loader2 } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { calculerAge } from "@/lib/age";
import { getMesContrats, getMesParticipants, openMesParticipantsListe } from "@/services/portailClient.service";
import { assurePhotoUrl } from "@/services/sante.service";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";
import { numeroPolice } from "@/lib/police";

// Statut simplifié côté client (2026-08) — voir demande utilisateur : "en
// matière de statut, on juste 'Actif' ou 'Rétiré'". Les nuances internes
// (Suspendu, Radié…) sont un détail de gestion propre à l'assureur ; pour le
// souscripteur, une personne est soit couverte, soit retirée du contrat.
function statutClientLabel(statut: string): string {
  return statut === "Actif" ? "Actif" : "Retiré";
}
function statutClientVariant(statut: string): BadgeVariant {
  return statut === "Actif" ? "success" : "danger";
}

const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint", EF: "Enfant" };

interface Famille { racine: AssureSante; membres: AssureSante[] }

function correspond(p: AssureSante, q: string): boolean {
  return `${p.nom} ${p.prenom ?? ""} ${p.matricule}`.toLowerCase().includes(q);
}

// Photo de profil — voir demande utilisateur : "on doit pouvoir voir la
// photo de profil de l'assuré et ses ayants droit". Repli sur une icône
// générique quand aucune photo n'a été téléchargée.
function Avatar({ photo, taille = 26 }: { photo?: string; taille?: number }) {
  const url = assurePhotoUrl(photo);
  return url ? (
    <img src={url} alt="" className="rounded-full object-cover shrink-0 border border-border" style={{ width: taille, height: taille }} />
  ) : (
    <div className="rounded-full bg-secondary flex items-center justify-center shrink-0" style={{ width: taille, height: taille }}>
      <User className="text-muted-foreground" style={{ width: taille * 0.55, height: taille * 0.55 }} />
    </div>
  );
}

// Fiche détaillée d'une personne (assuré principal ou ayant droit) — voir
// demande utilisateur : "on doit pouvoir le détails de l'assuré et de ses
// ayant droit pas juste les nom". Le téléphone n'est jamais porté que par la
// racine de famille (voir AssureSante.familleId), donc un ayant droit
// affiche celui hérité de sa racine.
function PersonCard({ p, racine }: { p: AssureSante; racine: AssureSante }) {
  const age = calculerAge(p.dateNaissance);
  const telephone = p.familleId ? racine.telephone : p.telephone;
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center gap-3 mb-2.5">
        <Avatar photo={p.photo} taille={44} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-foreground truncate">{p.nom} {p.prenom ?? ""}</p>
          <p className="text-[11px] text-muted-foreground">{LABEL_TYPE[p.typeAssure ?? "AS"] ?? p.typeAssure}</p>
        </div>
        <Badge variant={statutClientVariant(p.statut)}>{statutClientLabel(p.statut)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
        <div><p className="text-muted-foreground">Matricule</p><p className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{p.matricule}</p></div>
        <div><p className="text-muted-foreground">N° assuré</p><p className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{p.numeroAssure ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Date de naissance</p><p className="text-foreground">{p.dateNaissance ? `${p.dateNaissance}${age !== null ? ` (${age} ans)` : ""}` : "—"}</p></div>
        <div><p className="text-muted-foreground">Sexe</p><p className="text-foreground">{p.sexe === "M" ? "Masculin" : p.sexe === "F" ? "Féminin" : "—"}</p></div>
        <div><p className="text-muted-foreground">Statut carte</p><p className="text-foreground">{p.statutCarte ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Date d'affiliation</p><p className="text-foreground">{p.dateAffiliation ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Téléphone</p><p className="text-foreground">{telephone ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Adresse</p><p className="text-foreground truncate" title={p.adresse ?? undefined}>{p.adresse ?? "—"}</p></div>
        {!p.familleId ? (
          <div><p className="text-muted-foreground">Statut matrimonial</p><p className="text-foreground">{p.statutMatrimonial ?? "—"}</p></div>
        ) : p.typeAssure === "EF" ? (
          <div><p className="text-muted-foreground">Scolarisé</p><p className="text-foreground">{p.scolarise ? "Oui" : "Non"}</p></div>
        ) : null}
      </div>
    </div>
  );
}

// Liste des participants (bénéficiaires) du souscripteur connecté (2026-08)
// — cloisonnée à ses propres contrats (voir getMesParticipants), jamais aux
// bénéficiaires d'un autre client. Regroupée par famille (assuré principal +
// ses ayants droit) — voir demande utilisateur : "il faut créer un
// regroupement par famille... on doit pouvoir rentrer dans la famille pour
// voir l'assuré et ses ayants droit".
export default function PortailParticipantsView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratChoisi, setContratChoisi] = useState<Contrat | null>(null);
  const [participants, setParticipants] = useState<AssureSante[]>([]);
  const [recherche, setRecherche] = useState("");
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const [familleDetail, setFamilleDetail] = useState<Famille | null>(null);
  const [menuTelechargement, setMenuTelechargement] = useState(false);
  const [telechargement, setTelechargement] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMesContrats().then(setContrats);
  }, []);

  useEffect(() => {
    if (!menuTelechargement) return;
    const fermer = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuTelechargement(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [menuTelechargement]);

  useEffect(() => {
    getMesParticipants(contratChoisi?.id).then(setParticipants);
  }, [contratChoisi]);

  const familles: Famille[] = useMemo(() => {
    const racines = participants.filter((p) => !p.familleId);
    return racines.map((racine) => ({ racine, membres: participants.filter((p) => p.familleId === racine.id) }));
  }, [participants]);

  const q = recherche.trim().toLowerCase();
  const famillesFiltrees = q
    ? familles.filter((f) => correspond(f.racine, q) || f.membres.some((m) => correspond(m, q)))
    : familles;
  const totalPersonnes = famillesFiltrees.reduce((s, f) => s + 1 + f.membres.length, 0);

  // Une recherche qui ne matche qu'un ayant droit déplie automatiquement sa famille.
  useEffect(() => {
    if (!q) return;
    setOuvertes((v) => {
      const next = new Set(v);
      familles.forEach((f) => { if (!correspond(f.racine, q) && f.membres.some((m) => correspond(m, q))) next.add(f.racine.id); });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche]);

  const toggle = (id: string) => setOuvertes((v) => {
    const next = new Set(v);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Export imprimable/téléchargeable (2026-08) — voir demande utilisateur :
  // "la société doit pouvoir générer, télécharger et imprimer la liste de
  // ses bénéficiaires (liste totale, liste par type de statut)". Portée
  // par contrat (même granularité que le document interne) — résolu au
  // contrat filtré, ou au seul contrat du client s'il n'y en a qu'un.
  const contratPourTelechargement = contratChoisi ?? (contrats.length === 1 ? contrats[0] : null);

  const telecharger = async (statut: "tous" | "Actif" | "Radié", libelle: string) => {
    if (!contratPourTelechargement) return;
    try {
      setTelechargement(statut);
      setMenuTelechargement(false);
      await openMesParticipantsListe(contratPourTelechargement.id, statut);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Génération de la liste "${libelle}" impossible.`);
    } finally {
      setTelechargement(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[1.35rem] font-bold text-foreground">Mes Bénéficiaires</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{famillesFiltrees.length} famille(s) — {totalPersonnes} bénéficiaire(s)</p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={!contratPourTelechargement || telechargement !== null}
            onClick={() => setMenuTelechargement((v) => !v)}
            className="h-9 px-3.5 rounded-lg border border-border bg-card text-[13px] text-foreground hover:bg-secondary/40 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            title={contratPourTelechargement ? undefined : "Sélectionnez un contrat pour télécharger la liste"}
          >
            {telechargement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Télécharger la liste
          </button>
          {menuTelechargement && (
            <div className="absolute right-0 mt-1.5 w-56 bg-card border border-border rounded-lg shadow-lg z-20 py-1.5">
              <button type="button" onClick={() => telecharger("tous", "complète")} className="w-full text-left px-3.5 py-2 text-[12.5px] text-foreground hover:bg-secondary/40">Liste complète</button>
              <button type="button" onClick={() => telecharger("Actif", "des actifs")} className="w-full text-left px-3.5 py-2 text-[12.5px] text-foreground hover:bg-secondary/40">Bénéficiaires actifs uniquement</button>
              <button type="button" onClick={() => telecharger("Radié", "des retirés")} className="w-full text-left px-3.5 py-2 text-[12.5px] text-foreground hover:bg-secondary/40">Bénéficiaires retirés uniquement</button>
            </div>
          )}
          {!contratPourTelechargement && contrats.length > 1 && (
            <p className="text-[10.5px] text-muted-foreground mt-1 text-right">Sélectionnez un contrat pour télécharger</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {contrats.length > 1 && (
          <div className="w-full sm:w-64">
            <Combobox
              options={contrats}
              value={contratChoisi}
              onChange={setContratChoisi}
              getLabel={(c) => numeroPolice(c)}
              getSubLabel={(c) => c.branche}
              getId={(c) => c.id}
              allowClear
              clearLabel="Tous mes contrats"
              placeholder="Filtrer par contrat…"
            />
          </div>
        )}
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un participant…"
          className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Bénéficiaire</th>
              <th className="text-left px-4 py-2.5">Matricule</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Ayants droit</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {famillesFiltrees.map((f) => {
              const ouverte = ouvertes.has(f.racine.id);
              return (
                <Fragment key={f.racine.id}>
                  <tr className="hover:bg-secondary/25 cursor-pointer" onClick={() => setFamilleDetail(f)}>
                    <td className="px-4 py-2.5 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        {f.membres.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggle(f.racine.id); }}
                            className="p-0.5 -ml-1 rounded hover:bg-secondary/60 text-muted-foreground shrink-0"
                            title={ouverte ? "Masquer les ayants droit" : "Afficher les ayants droit"}
                          >
                            {ouverte ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <span className="w-[22px] shrink-0" />
                        )}
                        <Avatar photo={f.racine.photo} taille={26} />
                        {f.racine.nom} {f.racine.prenom ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f.racine.matricule}</td>
                    <td className="px-4 py-2.5 text-foreground">{LABEL_TYPE[f.racine.typeAssure ?? "AS"] ?? f.racine.typeAssure}</td>
                    <td className="px-4 py-2.5 text-foreground">{f.membres.length}</td>
                    <td className="px-4 py-2.5"><Badge variant={statutClientVariant(f.racine.statut)}>{statutClientLabel(f.racine.statut)}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFamilleDetail(f); }} className="text-muted-foreground hover:text-primary" title="Voir la fiche famille">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {ouverte && f.membres.map((m) => (
                    <tr key={m.id} className="bg-secondary/10 hover:bg-secondary/25 cursor-pointer" onClick={() => setFamilleDetail(f)}>
                      <td className="px-4 py-2 text-foreground text-[12.5px] pl-11">
                        <div className="flex items-center gap-2">
                          <Avatar photo={m.photo} taille={22} />
                          {m.nom} {m.prenom ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-[12.5px]" style={{ fontFamily: "'DM Mono', monospace" }}>{m.matricule}</td>
                      <td className="px-4 py-2 text-muted-foreground text-[12.5px]">{LABEL_TYPE[m.typeAssure ?? ""] ?? m.typeAssure}</td>
                      <td className="px-4 py-2 text-muted-foreground text-[12.5px]">—</td>
                      <td className="px-4 py-2"><Badge variant={statutClientVariant(m.statut)}>{statutClientLabel(m.statut)}</Badge></td>
                      <td className="px-4 py-2"></td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {famillesFiltrees.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun participant.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {familleDetail && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setFamilleDetail(null)}>
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Famille {familleDetail.racine.nom}</h3>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">{familleDetail.membres.length} ayant(s) droit</p>
              </div>
              <button type="button" onClick={() => setFamilleDetail(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Assuré principal</p>
                <PersonCard p={familleDetail.racine} racine={familleDetail.racine} />
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Ayants droit</p>
                <div className="space-y-2">
                  {familleDetail.membres.map((m) => (
                    <PersonCard key={m.id} p={m} racine={familleDetail.racine} />
                  ))}
                  {familleDetail.membres.length === 0 && <p className="text-[12px] text-muted-foreground">Aucun ayant droit déclaré.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

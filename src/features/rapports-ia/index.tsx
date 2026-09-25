import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { getRapportsIa, marquerRapportIaLu, type RapportConversationIA } from "@/services/rapportsIa.service";

// Rapports IA (2026-09) — voir demande utilisateur : "il faut aussi que
// Ariana fasse un rapport lorsqu'elle a pu gérer une demande et que
// l'assuré repart satisfait." Écran de supervision : chaque rapport
// correspond à UNE conversation qu'Ariana a résolue entièrement seule
// (jamais transmise à un conseiller, voir cloturer_conversation_resolue
// côté backend) — contrôle qualité pour les gestionnaires, jamais visible
// de l'assuré/prestataire lui-même.
const FILTRES = [
  { id: "tous", libelle: "Tous" },
  { id: "nonLus", libelle: "Non lus" },
  { id: "lus", libelle: "Lus" },
] as const;

export default function RapportsIaView() {
  const [rapports, setRapports] = useState<RapportConversationIA[]>([]);
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["id"]>("tous");
  const [chargement, setChargement] = useState(true);

  const charger = async (f: typeof filtre) => {
    setChargement(true);
    try {
      setRapports(await getRapportsIa(f === "tous" ? undefined : f === "lus"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(filtre); }, [filtre]); // eslint-disable-line react-hooks/exhaustive-deps

  const basculerLu = async (r: RapportConversationIA) => {
    try {
      const maj = await marquerRapportIaLu(r.id, !r.lu);
      setRapports((prev) => (filtre === "tous" ? prev.map((x) => (x.id === r.id ? maj : x)) : prev.filter((x) => x.id !== r.id)));
    } catch {
      toast.error("Impossible de mettre à jour ce rapport.");
    }
  };

  const nonLus = rapports.filter((r) => !r.lu).length;

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader
        title="Rapports IA"
        subtitle="Demandes qu'Ariana a traitées de bout en bout, sans transmission à un conseiller — pour contrôle qualité. Jamais visible des assurés ou prestataires."
        icon={Sparkles}
      />

      <div className="flex items-center gap-2">
        {FILTRES.map((f) => (
          <Btn key={f.id} variant={filtre === f.id ? "primary" : "secondary"} onClick={() => setFiltre(f.id)}>
            {f.libelle}{f.id === "nonLus" && nonLus > 0 && filtre !== "nonLus" ? ` (${nonLus})` : ""}
          </Btn>
        ))}
      </div>

      <div className="space-y-3">
        {rapports.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground text-sm">{r.objet}</div>
                <div className="text-xs text-muted-foreground">
                  {r.demandeurNom} · <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={r.lu ? "neutral" : "info"}>{r.lu ? "Lu" : "Non lu"}</Badge>
                <Btn variant="secondary" onClick={() => basculerLu(r)}>{r.lu ? "Marquer non lu" : "Marquer lu"}</Btn>
              </div>
            </div>
            <p className="text-[13px] text-foreground/90 whitespace-pre-wrap">{r.resume}</p>
          </div>
        ))}
        {!chargement && rapports.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Aucun rapport {filtre === "nonLus" ? "non lu" : filtre === "lus" ? "lu" : ""} pour l'instant.
          </div>
        )}
      </div>
    </div>
  );
}

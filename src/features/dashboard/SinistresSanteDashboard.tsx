import { useEffect, useState } from "react";
import { ClipboardCheck, Stethoscope, Clock, FileEdit, Plus } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { useAuth } from "@/auth/AuthContext";
import { fmtM } from "@/lib/format";
import { getAccordsPrealables } from "@/services/accordPrealable.service";
import { getFactures } from "@/services/factures.service";
import { getPriseEnCharges } from "@/services/sante.service";
import type { AccordPrealable } from "@/types/accordPrealable";
import type { Facture } from "@/types/facture";
import type { PriseEnCharge } from "@/types/sante";

// En assurance santé, il n'y a pas de notion de "sinistre" distincte : le
// dossier à traiter, c'est la facture (ou la demande d'entente préalable)
// du prestataire — voir feedback utilisateur. Ce tableau de bord reflète
// donc les tâches réellement en attente : accords préalables à décider,
// factures en cours de saisie, mes prises en charge (remboursements).
const typeUrgenceVariant: Record<string, "danger" | "warning" | "neutral"> = {
  "Hospitalisation": "danger", "EVASAN": "danger", "Chirurgie": "warning",
};

export default function SinistresSanteDashboard() {
  const { setView, triggerShellAction } = useShellNavigation();
  const { currentUser } = useAuth();
  const [accords, setAccords] = useState<AccordPrealable[]>([]);
  const [mesFactures, setMesFactures] = useState<Facture[]>([]);
  const [mesPrisesEnCharge, setMesPrisesEnCharge] = useState<PriseEnCharge[]>([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    getAccordsPrealables().then(setAccords);
    // Filtré côté serveur (2026-09, était `getFactures()`/`getPriseEnCharges()`
    // sans filtre — tout le portefeuille de la société rapatrié pour ne
    // garder que les quelques lignes du gestionnaire courant) — voir
    // demande utilisateur : "je veux la rapidité, la fluidité". Mesuré en
    // production : ce tableau de bord à lui seul déclenchait le
    // téléchargement de dizaines de Mo de JSON à chaque ouverture.
    getFactures({ statut: "En saisie", gestionnaireId: currentUser.id }).then(setMesFactures);
    getPriseEnCharges(undefined, currentUser.id).then(setMesPrisesEnCharge);
  }, [currentUser?.id]);

  // Accords préalables "en attente" (2026-08) — reste une VRAIE file
  // d'attente partagée entre les gestionnaires santé/sinistres (aucun
  // dossier non tranché n'a encore de "propriétaire" à filtrer) plutôt
  // qu'une donnée personnelle — voir demande utilisateur : "en fonction du
  // profil de l'utilisateur" est déjà respecté au niveau du RÔLE (seuls les
  // rôles santé/sinistres voient ce tableau de bord, voir roleFamilies.ts).
  // Factures et prises en charge, elles, sont personnelles (voir
  // gestionnaireId).
  const accordsEnAttente = accords.filter((a) => a.decision === "En attente");
  const facturesEnSaisie = mesFactures;
  const prisesEnCharge = mesPrisesEnCharge;
  const priseEnChargeActives = prisesEnCharge.filter((pc) => pc.statut === "Accordé");
  const montantEngage = priseEnChargeActives.reduce((a, b) => a + b.montant, 0);

  return (
    <div className="p-6 space-y-6">
      <ModuleHeader title="Tableau de Bord — Prise en charge & Facturation" subtitle="Mes tâches : accords préalables, factures et remboursements"
        icon={Stethoscope}
        actions={(
          <div className="flex items-center gap-2">
            <Btn variant="primary" onClick={() => { setView("prisesEnCharge"); triggerShellAction("prisesEnCharge", "Nouvelle prise en charge", "top"); toast.success("Ouverture de la saisie de prise en charge"); }}><Plus className="w-4 h-4" />Déclarer une prise en charge</Btn>
            <Btn variant="primary" onClick={() => { setView("prisesEnCharge"); toast.success("Ouverture du module Factures"); }}><Plus className="w-4 h-4" />Nouvelle facture</Btn>
          </div>
        )}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Accords préalables en attente" value={String(accordsEnAttente.length)} icon={ClipboardCheck} accent="bg-amber-500/10" />
        <StatCard title="Mes factures en saisie" value={String(facturesEnSaisie.length)} icon={FileEdit} />
        <StatCard title="Mes prises en charge actives" value={String(priseEnChargeActives.length)} icon={Stethoscope} />
        <StatCard title="Montant engagé" value={`${fmtM(montantEngage)} FCFA`} icon={Clock} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Accords préalables en attente</h3>
          </div>
          <div className="divide-y divide-border/50">
            {accordsEnAttente.slice(0, 7).map((a) => (
              <div key={a.id} onClick={() => setView("accordPrealable")} className="flex items-start justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-primary med-num">{a.id}</span>
                    <Badge variant={typeUrgenceVariant[a.type] ?? "neutral"}>{a.type}</Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">{a.assureNom}</p>
                  <p className="text-xs text-muted-foreground">{a.prestataire}</p>
                </div>
                <p className="text-xs font-semibold text-foreground flex-shrink-0 med-num">{a.montantDevis !== undefined ? fmtM(a.montantDevis) : "—"}</p>
              </div>
            ))}
            {accordsEnAttente.length === 0 && (
              <div className="px-4 py-6">
                <p className="med-empty-state px-4 py-5 text-sm text-muted-foreground text-center">Aucun accord préalable en attente</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Mes prises en charge récentes</h3>
          </div>
          <div className="divide-y divide-border/50">
            {prisesEnCharge.slice(0, 7).map((pc) => (
              <div key={pc.id} onClick={() => setView("prisesEnCharge")} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                  <p className="text-xs text-muted-foreground">{pc.prestataire} · {pc.type}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-semibold text-foreground med-num">{fmtM(pc.montant)}</p>
                  <Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge>
                </div>
              </div>
            ))}
            {prisesEnCharge.length === 0 && (
              <div className="px-4 py-6">
                <p className="med-empty-state px-4 py-5 text-sm text-muted-foreground text-center">Aucune prise en charge qui vous est assignée</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

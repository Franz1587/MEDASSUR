import { useEffect, useState } from "react";
import { IdCard, ShieldCheck, ClipboardCheck, Receipt, MapPinned, History, Wallet, PiggyBank, Users2, Layers } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import { Badge } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getMembreDashboard, type MembreDashboard } from "@/services/portailMembre.service";

const TUILES = [
  { view: "membreCarte" as const, label: "Ma carte", icon: IdCard, couleur: "bg-primary/10 text-primary" },
  { view: "membrePriseEnCharge" as const, label: "Prise en charge", icon: ClipboardCheck, couleur: "bg-amber-500/10 text-amber-600" },
  { view: "membreRemboursement" as const, label: "Remboursement", icon: Receipt, couleur: "bg-emerald-500/10 text-emerald-600" },
  { view: "membreReseauSoins" as const, label: "Réseau de soins", icon: MapPinned, couleur: "bg-sky-500/10 text-sky-600" },
];

// Accueil du portail assuré (2026-08) — voir demande utilisateur : "écran
// externe dédié à l'assuré principal", modelé sur des maquettes de
// référence fournies par l'utilisateur : bienvenue, statut carte, tuiles d'accès
// rapide, résumé.
export default function MembreDashboardView() {
  const { currentUser } = useAuth();
  const { setView } = useShellNavigation();
  const [data, setData] = useState<MembreDashboard | null>(null);

  useEffect(() => { getMembreDashboard().then(setData); }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <p className="text-[13px] text-muted-foreground">Bienvenue,</p>
        <h1 className="text-[1.35rem] font-bold text-foreground">{currentUser?.nom ?? "…"}</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between max-w-5xl mb-5">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Statut de ma carte</p>
          <p className="text-[15px] font-semibold text-foreground mt-0.5">{data?.statutCarte ?? "…"}</p>
        </div>
        <Badge variant={data?.statutCarte === "Active" ? "success" : "warning"}>{data?.statutCarte ?? "…"}</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-5xl mb-6">
        {TUILES.map((t) => (
          <button
            key={t.view}
            type="button"
            onClick={() => setView(t.view)}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col items-start gap-2.5 hover:border-primary/40 transition-colors text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.couleur}`}>
              <t.icon className="w-4.5 h-4.5" />
            </div>
            <span className="text-[13px] font-semibold text-foreground">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" />Prise en charge</p>
            <button type="button" onClick={() => setView("membrePriseEnCharge")} className="text-[11.5px] text-primary hover:underline">Voir</button>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            {data ? `${data.priseEnChargeEnAttente} demande(s) en attente` : "…"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-foreground flex items-center gap-2"><History className="w-4 h-4 text-primary" />Dernier remboursement</p>
            <button type="button" onClick={() => setView("membreRemboursement")} className="text-[11.5px] text-primary hover:underline">Voir</button>
          </div>
          {data?.dernierRemboursement ? (
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted-foreground">{data.dernierRemboursement.date}</span>
              {/* Part assurance (ce qui est réellement remboursé), jamais les
                  frais réels présentés — voir demande utilisateur. */}
              {data.dernierRemboursement.baseRemboursement != null ? (
                <span className="font-semibold text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(Number(data.dernierRemboursement.baseRemboursement))} FCFA</span>
              ) : (
                <span className="font-semibold text-muted-foreground">En cours de traitement</span>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">Aucune demande de remboursement pour l'instant.</p>
          )}
        </div>
      </div>

      {/* Statistiques de consommation (2026-08) — voir demande utilisateur :
          "tableau de bord qui fait remonter les données statistiques de
          consommation de toute la famille pour l'assuré principal, et de
          l'ayant droit dans son compte" — data.estAssurePrincipal indique
          si le périmètre ci-dessous couvre le foyer entier ou seulement
          soi-même (déjà résolu côté serveur). */}
      <div className="max-w-5xl mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">
          {data?.estAssurePrincipal ? "Consommation du foyer" : "Ma consommation"}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />Total des soins</p>
            <p className="text-[17px] font-bold text-foreground mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>{data ? `${fmtM(data.totalConsommation)} FCFA` : "…"}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5" />Total remboursé</p>
            <p className="text-[17px] font-bold text-emerald-600 mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>{data ? `${fmtM(data.totalRembourse)} FCFA` : "…"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data?.estAssurePrincipal && data.parBeneficiaire.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[12.5px] font-semibold text-foreground flex items-center gap-2 mb-3"><Users2 className="w-4 h-4 text-primary" />Par bénéficiaire</p>
              <div className="space-y-2.5">
                {data.parBeneficiaire.map((b) => {
                  const pct = data.totalConsommation > 0 ? Math.round((b.total / data.totalConsommation) * 100) : 0;
                  return (
                    <div key={b.assureId}>
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="text-foreground">{b.nom}</span>
                        <span className="text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(b.total)} FCFA</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data && data.parRubrique.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[12.5px] font-semibold text-foreground flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-primary" />Par rubrique</p>
              <div className="space-y-2">
                {data.parRubrique.slice(0, 6).map((r) => (
                  <div key={r.rubrique} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground truncate pr-2">{r.rubrique}</span>
                    <span className="text-foreground font-medium flex-shrink-0" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(r.total)} FCFA</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground pt-5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Vos données ne sont visibles que par vous.
      </div>
    </div>
  );
}

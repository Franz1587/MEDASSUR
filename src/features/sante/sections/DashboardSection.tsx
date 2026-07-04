import { useEffect, useState } from "react";
import { Users, Clock, Wallet, ShieldCheck } from "lucide-react";
import { getAssuresSante, getPriseEnCharges } from "@/services/sante.service";
import { getFondsDeRoulement } from "@/services/fondsDeRoulement.service";
import { getAccordsPrealables } from "@/services/accordPrealable.service";

interface Stats {
  assuresActifs: number;
  controlesEnCours: number;
  fondsAlerte: number;
  accordsEnAttente: number;
}

export default function DashboardSection() {
  const [stats, setStats] = useState<Stats>({ assuresActifs: 0, controlesEnCours: 0, fondsAlerte: 0, accordsEnAttente: 0 });

  useEffect(() => {
    Promise.all([getAssuresSante(), getPriseEnCharges(), getFondsDeRoulement(), getAccordsPrealables()]).then(
      ([assures, prises, fonds, accords]) => {
        setStats({
          assuresActifs: assures.filter((a) => a.statut === "Actif").length,
          controlesEnCours: prises.filter((p) => p.statutControleMedical === "En cours").length,
          fondsAlerte: fonds.filter((f) => f.statut === "Alerte" || f.statut === "Épuisé").length,
          accordsEnAttente: accords.filter((a) => a.decision === "En attente").length,
        });
      },
    );
  }, []);

  const cards = [
    { label: "Assurés actifs", value: stats.assuresActifs, icon: Users, color: "text-primary" },
    { label: "Prises en charge — contrôle médical en cours", value: stats.controlesEnCours, icon: Clock, color: "text-amber-400" },
    { label: "Fonds de roulement en alerte", value: stats.fondsAlerte, icon: Wallet, color: "text-red-400" },
    { label: "Accords préalables en attente", value: stats.accordsEnAttente, icon: ShieldCheck, color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-xl p-4">
          <c.icon className={`w-5 h-5 mb-2.5 ${c.color}`} />
          <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{c.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

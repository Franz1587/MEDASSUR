import { useEffect, useState } from "react";
import {
  Target, FileText, AlertTriangle, Stethoscope, Truck, BookOpen,
  CreditCard, Search, Handshake, Building2, type LucideIcon,
} from "lucide-react";

interface Profession {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const professions: Profession[] = [
  { icon: Target, title: "Commercial", desc: "Pipeline CRM et devis multi-compagnies en quelques clics" },
  { icon: FileText, title: "Gestionnaire Production", desc: "Contrats, renouvellements et avenants centralisés" },
  { icon: AlertTriangle, title: "Gestionnaire Sinistres", desc: "De la déclaration au règlement, un dossier entièrement tracé" },
  { icon: Stethoscope, title: "Gestionnaire Santé", desc: "Prises en charge et remboursements simplifiés" },
  { icon: Truck, title: "Gestionnaire Flotte", desc: "Suivi véhicule par véhicule, sinistres compris" },
  { icon: BookOpen, title: "Comptable", desc: "Comptabilité SYSCOHADA et trésorerie en temps réel" },
  { icon: CreditCard, title: "Agent de Recouvrement", desc: "Relances automatisées, multi-canaux, Mobile Money inclus" },
  { icon: Search, title: "Expert Automobile", desc: "Expertise terrain digitalisée, rapports en un clic" },
  { icon: Handshake, title: "Courtier Partenaire", desc: "Un espace dédié pour vos clients référés et vos commissions" },
  { icon: Building2, title: "Compagnie d'Assurance", desc: "Produits, propositions reçues et affaires en cours" },
];

const INTERVAL_MS = 3200;

export function ProfessionsCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % professions.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const current = professions[index];

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Un métier, une interface</p>
      <div key={index} className="flex items-start gap-3 animate-[fadeIn_0.5s_ease]">
        <div className="p-2.5 bg-primary/15 rounded-xl border border-primary/25 flex-shrink-0">
          <current.icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-white">{current.title}</p>
          <p className="text-sm text-white/50 mt-0.5">{current.desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {professions.map((p, i) => (
          <button
            key={p.title}
            onClick={() => setIndex(i)}
            aria-label={p.title}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/30"}`}
          />
        ))}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

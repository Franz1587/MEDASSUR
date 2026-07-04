import { useState } from "react";
import { Shield, Building2, Users, KeyRound, ArrowLeft, Sparkles } from "lucide-react";
import { roleList, type RoleId } from "@/auth/roles";
import { mockUsers } from "@/auth/mockUsers";
import { useAuth, DEMO_PASSWORD } from "@/auth/AuthContext";
import { LoginForm } from "@/auth/LoginForm";

const valueProps = [
  { label: "19 profils dédiés", desc: "Un espace pensé pour chaque métier du courtage" },
  { label: "15+ branches d'assurance", desc: "IARD, Vie, Santé, Flotte, Prévoyance…" },
  { label: "Zone CIMA · 14 pays", desc: "Conforme SYSCOHADA et aux normes CIMA" },
];

function DemoRoleGrid({ onBack }: { onBack: () => void }) {
  const { login } = useAuth();
  const internes = roleList.filter((r) => r.family === "interne");
  const externes = roleList.filter((r) => r.family === "externe");

  const RoleGrid = ({ items }: { items: typeof roleList }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {items.map((r) => {
        const user = mockUsers[r.id as RoleId];
        return (
          <button
            key={r.id}
            onClick={() => login(user.email, DEMO_PASSWORD)}
            className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{user.initiales}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
              <p className="text-xs text-muted-foreground truncate">{user.nom}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Mode démo</h2>
          <p className="text-sm text-muted-foreground mt-1">Choisissez un profil — aucun mot de passe requis</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
          <Users className="w-3.5 h-3.5" /> Utilisateurs internes du cabinet
        </div>
        <RoleGrid items={internes} />

        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest pt-2">
          <Building2 className="w-3.5 h-3.5" /> Partenaires & portails externes
        </div>
        <RoleGrid items={externes} />
      </div>
    </div>
  );
}

export function LoginView() {
  const [mode, setMode] = useState<"form" | "demo">("form");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0D1B2E 0%, #070F1C 60%, #050B15 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle at 20% 20%, #C9A24A 0%, transparent 45%)" }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>CourtEVA+</p>
            <p className="text-xs text-white/50 leading-tight">Insurance Suite</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            La plateforme de courtage nouvelle génération pour l'Afrique
          </h1>
          <div className="space-y-4">
            {valueProps.map((v) => (
              <div key={v.label} className="flex items-start gap-3">
                <div className="p-1.5 bg-primary/15 rounded-lg border border-primary/25 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{v.label}</p>
                  <p className="text-xs text-white/50">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/30">© 2026 CourtEVA+ Insurance Suite</p>
      </div>

      {/* Content pane */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-base font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>CourtEVA+</p>
        </div>

        {mode === "form" ? (
          <div className="w-full max-w-sm space-y-6">
            <LoginForm />
            <button
              onClick={() => setMode("demo")}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" /> Mode démo — choisir un profil sans mot de passe
            </button>
          </div>
        ) : (
          <DemoRoleGrid onBack={() => setMode("form")} />
        )}
      </div>
    </div>
  );
}

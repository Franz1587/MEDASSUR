import { Shield, Building2, Users } from "lucide-react";
import { roleList, type RoleId } from "@/auth/roles";
import { mockUsers } from "@/auth/mockUsers";
import { useAuth } from "@/auth/AuthContext";

export function LoginView() {
  const { login } = useAuth();
  const internes = roleList.filter((r) => r.family === "interne");
  const externes = roleList.filter((r) => r.family === "externe");

  const RoleGrid = ({ items }: { items: typeof roleList }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((r) => {
        const user = mockUsers[r.id as RoleId];
        return (
          <button
            key={r.id}
            onClick={() => login(r.id)}
            className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>CourtEVA+ Insurance Suite</h1>
          <p className="text-sm text-muted-foreground">Sélectionnez un profil pour accéder à la plateforme — zone CIMA</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
            <Users className="w-3.5 h-3.5" /> Utilisateurs internes du cabinet
          </div>
          <RoleGrid items={internes} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
            <Building2 className="w-3.5 h-3.5" /> Partenaires & portails externes
          </div>
          <RoleGrid items={externes} />
        </div>
      </div>
    </div>
  );
}

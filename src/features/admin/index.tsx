import { useEffect, useState } from "react";
import { Settings, Plus, Filter, Edit } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { getUsers, getRoleSummaries } from "@/services/admin.service";
import type { UserAccount, RoleSummary } from "@/types/admin";

export default function AdminView() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);

  useEffect(() => {
    getUsers().then(setUsers);
    getRoleSummaries().then(setRoles);
  }, []);

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Administration Système" subtitle="Utilisateurs, rôles, permissions et paramètres plateforme" icon={Settings}
        actions={<Btn variant="primary"><Plus className="w-4 h-4" />Nouvel utilisateur</Btn>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Utilisateurs ({users.length})</h3>
            <Btn variant="ghost"><Filter className="w-4 h-4" />Filtrer</Btn>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Utilisateur", "Rôle", "Dernière connexion", "Statut", ""].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {u.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{u.nom}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.role}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.login}</td>
                  <td className="px-4 py-3"><Badge variant={u.statut === "Actif" ? "success" : "neutral"}>{u.statut}</Badge></td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Rôles & Permissions</h3>
          </div>
          <div className="divide-y divide-border/50">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.nom}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-sm font-bold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{r.n}</p>
                  <p className="text-xs text-muted-foreground">users</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

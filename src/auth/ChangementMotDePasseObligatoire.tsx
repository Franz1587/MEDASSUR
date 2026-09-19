import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { http, messageErreur } from "@/lib/http";
import { useAuth } from "./AuthContext";

const fieldCls = "w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground";
const labelCls = "text-[11px] text-muted-foreground mb-1";

// Changement de mot de passe imposé (2026-09) — voir demande utilisateur :
// "la saisie du mot de passe pour la première fois ne demande pas de
// réinitialiser le mot de passe à la première connexion... pour une
// meilleure sécurité". Rendu par ProtectedRoute (App.tsx) À LA PLACE du
// shell normal tant que currentUser.doitChangerMotDePasse est vrai — donc
// pour TOUT rôle (interne comme externe) sans exception, avant le moindre
// accès aux données. Réutilise l'endpoint existant PATCH /users/moi/mot-de-
// passe (UsersService.changerMotDePasse), qui remet le drapeau à false.
export function ChangementMotDePasseObligatoire() {
  const { refreshCurrentUser, logout } = useAuth();
  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nouveauMotDePasse.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (nouveauMotDePasse !== confirmation) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    try {
      setSubmitting(true);
      await http.patch("/users/moi/mot-de-passe", { ancienMotDePasse, nouveauMotDePasse });
      toast.success("Mot de passe mis à jour.");
      await refreshCurrentUser();
    } catch (err) {
      toast.error(messageErreur(err, "Impossible de changer le mot de passe."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-[15px] font-bold text-foreground">Nouveau mot de passe requis</h1>
            <p className="text-[12px] text-muted-foreground mt-1">
              Pour votre sécurité, vous devez choisir un nouveau mot de passe avant de continuer — celui que vous avez reçu était temporaire.
            </p>
          </div>
        </div>
        <form onSubmit={soumettre} className="space-y-3">
          <label className="block">
            <div className={labelCls}>Mot de passe actuel (reçu par SMS/WhatsApp)</div>
            <input type="password" value={ancienMotDePasse} onChange={(e) => setAncienMotDePasse(e.target.value)} required autoFocus className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Nouveau mot de passe</div>
            <input type="password" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} required minLength={8} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Confirmer le nouveau mot de passe</div>
            <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required minLength={8} className={fieldCls} />
          </label>
          <button type="submit" disabled={submitting} className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-60">
            {submitting ? "Enregistrement…" : "Valider"}
          </button>
        </form>
        <button type="button" onClick={logout} className="w-full text-center text-[11.5px] text-muted-foreground hover:text-foreground">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

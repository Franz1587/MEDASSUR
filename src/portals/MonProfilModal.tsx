import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, User, KeyRound, Save } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getMoi } from "@/services/maSignature.service";
import { modifierMonProfil, changerMonMotDePasse } from "@/services/monProfil.service";
import { SignatureManager } from "@/components/shared/SignatureManager";
import type { UserAccount } from "@/types/admin";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground disabled:opacity-60 disabled:cursor-not-allowed";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// "Mon profil" — écran RÉEL en libre-service pour tous les portails
// externes (assuré, souscripteur, médecin, prestataire...) (2026-09) — voir
// demande utilisateur : "un vrai formulaire Mon profil... c'est là qu'il
// aura toutes les infos de son profil... qu'il pourra changer de mot de
// passe et c'est là qu'il pourra gérer sa signature. La signature ne doit
// pas apparaître sur l'écran d'accueil." Remplace l'ancien popover minimal
// (nom/email + signature seule, voir PortalShell.tsx avant cette date).
export function MonProfilModal({ onClose }: { onClose: () => void }) {
  const { currentRole, refreshCurrentUser } = useAuth();
  const [compte, setCompte] = useState<UserAccount | null>(null);
  const [chargement, setChargement] = useState(true);

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [saving, setSaving] = useState(false);

  const [ancienMdp, setAncienMdp] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [savingMdp, setSavingMdp] = useState(false);

  useEffect(() => {
    getMoi()
      .then((u) => {
        setCompte(u);
        setNom(u.nom);
        setTelephone(u.telephone ?? "");
        setAdresse(u.adresse ?? "");
      })
      .catch(() => toast.error("Impossible de charger votre profil."))
      .finally(() => setChargement(false));
  }, []);

  const enregistrerProfil = async () => {
    if (!nom.trim()) { toast.error("Le nom ne peut pas être vide."); return; }
    setSaving(true);
    try {
      const u = await modifierMonProfil({ nom: nom.trim(), telephone: telephone.trim() || undefined, adresse: adresse.trim() || undefined });
      setCompte(u);
      await refreshCurrentUser();
      toast.success("Profil mis à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const changerMotDePasse = async () => {
    if (!ancienMdp || !nouveauMdp) { toast.error("Renseignez votre mot de passe actuel et le nouveau."); return; }
    if (nouveauMdp.length < 8) { toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (nouveauMdp !== confirmationMdp) { toast.error("La confirmation ne correspond pas au nouveau mot de passe."); return; }
    setSavingMdp(true);
    try {
      await changerMonMotDePasse(ancienMdp, nouveauMdp);
      setAncienMdp(""); setNouveauMdp(""); setConfirmationMdp("");
      toast.success("Mot de passe changé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mot de passe actuel incorrect.");
    } finally {
      setSavingMdp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[96] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-[15px] font-semibold text-foreground">Mon profil</h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {chargement ? (
            <p className="text-[13px] text-muted-foreground text-center py-6">Chargement…</p>
          ) : (
            <>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className={labelCls}>Nom *</div>
                    <input value={nom} onChange={(e) => setNom(e.target.value)} className={fieldCls} />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Email</div>
                    <input value={compte?.email ?? ""} disabled className={fieldCls} title="L'email de connexion ne peut pas être modifié ici." />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Téléphone</div>
                    <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={fieldCls} placeholder="+241 …" />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Rôle</div>
                    <input value={currentRole?.label ?? ""} disabled className={fieldCls} />
                  </label>
                  <label className="block col-span-2">
                    <div className={labelCls}>Adresse</div>
                    <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={fieldCls} />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button" onClick={enregistrerProfil} disabled={saving}
                    className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />{saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-[13px] font-semibold text-foreground flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />Changer de mot de passe</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block col-span-2">
                    <div className={labelCls}>Mot de passe actuel</div>
                    <input type="password" value={ancienMdp} onChange={(e) => setAncienMdp(e.target.value)} className={fieldCls} autoComplete="current-password" />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Nouveau mot de passe</div>
                    <input type="password" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} className={fieldCls} autoComplete="new-password" />
                  </label>
                  <label className="block">
                    <div className={labelCls}>Confirmation</div>
                    <input type="password" value={confirmationMdp} onChange={(e) => setConfirmationMdp(e.target.value)} className={fieldCls} autoComplete="new-password" />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button" onClick={changerMotDePasse} disabled={savingMdp}
                    className="h-9 px-4 rounded-xl border border-border text-foreground text-[12.5px] font-semibold hover:bg-secondary/40 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {savingMdp ? "Changement…" : "Changer le mot de passe"}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <SignatureManager />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

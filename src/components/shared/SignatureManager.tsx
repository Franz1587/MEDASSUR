import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, QrCode, Trash2, X } from "lucide-react";
import {
  getMoi, uploaderMaSignature, supprimerMaSignature, genererQrSignature, statutJetonSignature, signatureUrl,
  type JetonSignatureQr,
} from "@/services/maSignature.service";
import { getUser, uploadUserSignature, deleteUserSignature, genererQrSignatureUtilisateur } from "@/services/admin.service";

interface SignatureManagerProps {
  // Mode admin (2026-09) — voir demande utilisateur : "les options qui
  // permettent d'ajouter la signature pour chaque type d'utilisateur"
  // depuis l'écran Utilisateurs. Quand fourni, ce composant gère la
  // signature DE CE COMPTE (via backend/src/users/users.controller.ts,
  // réservé aux rôles d'administration) au lieu de la signature de la
  // personne connectée. `nom` sert uniquement à personnaliser les textes.
  userId?: string;
  nom?: string;
}

// Signature électronique (2026-09) — voir demande utilisateur : "le médecin
// puisse dans son compte mettre sa signature. Il pourra charger un fichier
// de sa signature en image... ou l'application devra générer un QR code
// qui sera scanné." Composant PARTAGÉ entre AdminShell.tsx (écran interne)
// et PortalShell.tsx (tous les portails externes — médecin, assuré,
// souscripteur, agent d'une société comme LA RUCHE EXCELLENCE...) en mode
// libre-service (sans `userId`), ET entre les écrans Utilisateurs
// (interne + Super Admin) en mode admin (avec `userId`) : la logique
// (upload, QR, suppression) est strictement la même, seule la cible
// (soi-même ou le compte édité) diffère.
export function SignatureManager({ userId, nom }: SignatureManagerProps = {}) {
  const modeAdmin = !!userId;
  const [signature, setSignature] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [jeton, setJeton] = useState<JetonSignatureQr | null>(null);
  const [envoiFichier, setEnvoiFichier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rafraichir = () => {
    setChargement(true);
    const p = modeAdmin ? getUser(userId!) : getMoi();
    p.then((u) => setSignature(u.signature ?? null)).catch(() => undefined).finally(() => setChargement(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(rafraichir, [userId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const choisirFichier = () => fileInputRef.current?.click();

  const surFichierChoisi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEnvoiFichier(true);
    try {
      const u = modeAdmin ? await uploadUserSignature(userId!, file) : await uploaderMaSignature(file);
      setSignature(u.signature ?? null);
      toast.success("Signature enregistrée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoiFichier(false);
    }
  };

  const supprimer = async () => {
    if (!window.confirm(modeAdmin ? `Supprimer la signature de ${nom ?? "ce compte"} ?` : "Supprimer votre signature ?")) return;
    try {
      if (modeAdmin) await deleteUserSignature(userId!); else await supprimerMaSignature();
      setSignature(null);
      toast.success("Signature supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  const ouvrirQr = async () => {
    try {
      const j = modeAdmin ? await genererQrSignatureUtilisateur(userId!) : await genererQrSignature();
      setJeton(j);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const { signe } = await statutJetonSignature(j.token).catch(() => ({ signe: false }));
        if (signe) {
          if (pollRef.current) clearInterval(pollRef.current);
          setJeton(null);
          rafraichir();
          toast.success("Signature reçue depuis le téléphone.");
        }
      }, 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération du QR code impossible.");
    }
  };

  const fermerQr = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setJeton(null);
  };

  return (
    <div>
      <h3 className="text-[14px] font-semibold text-foreground mb-3">Signature électronique</h3>
      <p className="text-[12px] text-muted-foreground mb-3">
        {modeAdmin
          ? `Ajoutée automatiquement sur les documents où la signature de ${nom ?? "ce compte"} est requise.`
          : "Ajoutée automatiquement sur les documents où votre signature est requise."}
      </p>

      <div className="flex items-start gap-4">
        <div className="w-40 h-24 rounded-xl border border-dashed border-border bg-background/70 flex items-center justify-center overflow-hidden flex-shrink-0">
          {chargement ? (
            <span className="text-[11px] text-muted-foreground">Chargement…</span>
          ) : signature ? (
            <img src={signatureUrl(signature)} alt="Signature" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-[11px] text-muted-foreground px-2 text-center">Aucune signature</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={surFichierChoisi} />
          <button
            type="button" onClick={choisirFichier} disabled={envoiFichier}
            className="h-9 px-3.5 rounded-xl border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Upload className="w-3.5 h-3.5" />{envoiFichier ? "Envoi…" : "Charger un fichier"}
          </button>
          <button
            type="button" onClick={ouvrirQr}
            className="h-9 px-3.5 rounded-xl border border-border text-[12.5px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />{modeAdmin ? "Faire signer depuis un téléphone" : "Signer depuis mon téléphone"}
          </button>
          {signature && (
            <button
              type="button" onClick={supprimer}
              className="h-9 px-3.5 rounded-xl border border-destructive/40 text-destructive text-[12.5px] hover:bg-destructive/10 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />Supprimer
            </button>
          )}
        </div>
      </div>

      {jeton && (
        <div className="fixed inset-0 z-[97] bg-black/50 flex items-center justify-center p-4" onClick={fermerQr}>
          <div className="w-full max-w-xs bg-card border border-border rounded-2xl shadow-2xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button type="button" onClick={fermerQr} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[13.5px] font-semibold text-foreground mb-1">{modeAdmin ? `À faire scanner par ${nom ?? "la personne concernée"}` : "Scannez avec votre téléphone"}</p>
            <p className="text-[11.5px] text-muted-foreground mb-4">
              {modeAdmin
                ? `La signature s'enregistre automatiquement dans le compte de ${nom ?? "cette personne"} une fois validée sur son téléphone.`
                : "La signature s'enregistre automatiquement dans votre compte une fois validée."}
            </p>
            <img src={jeton.qrDataUrl} alt="QR code de signature" className="w-48 h-48 mx-auto rounded-lg border border-border" />
            <p className="text-[11px] text-muted-foreground mt-3">En attente de la signature…</p>
          </div>
        </div>
      )}
    </div>
  );
}

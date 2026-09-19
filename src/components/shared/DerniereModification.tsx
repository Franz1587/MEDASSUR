import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { getDerniereModification } from "@/services/audit.service";
import type { DerniereModification as DerniereModificationInfo } from "@/types/audit";

// Journal des opérations (2026-08) — traçabilité affichée directement sur
// la fiche (contrat/facture/prise en charge…) : date de la dernière
// modification et personne l'ayant faite (voir demande utilisateur).
// Alimenté par AuditLog, jamais déclenché par une simple consultation
// (aucun GET n'est journalisé, voir AuditInterceptor).
export function DerniereModification({ entite, entiteId }: { entite: string; entiteId?: string }) {
  const [info, setInfo] = useState<DerniereModificationInfo | null>(null);

  useEffect(() => {
    if (!entiteId) { setInfo(null); return; }
    getDerniereModification(entite, entiteId).then(setInfo).catch(() => setInfo(null));
  }, [entite, entiteId]);

  if (!info) return null;
  const label = info.action === "Créé" ? "Créé" : "Dernière modification";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={info.entiteId}>
      <History className="w-3 h-3 flex-shrink-0" />
      {label} le {new Date(info.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} par {info.utilisateurNom}
    </span>
  );
}

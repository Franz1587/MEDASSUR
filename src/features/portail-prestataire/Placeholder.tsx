interface PlaceholderProps {
  titre: string;
  description: string;
}

// Rubriques de la maquette de référence pas encore développées (2026-08) —
// voir demande utilisateur : "on va faire des ajustements progressivement.
// Mais je veux d'abord que tu duplique cela" — la structure de navigation
// (Contacts & Interloc. / Devis / Gestion financière / Logistique, voir
// capture de référence fournie par l'utilisateur) est déjà fidèle au modèle ; le contenu de ces
// rubriques suivra.
export function PortailPrestatairePlaceholder({ titre, description }: PlaceholderProps) {
  return (
    <div className="p-6">
      <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide mb-4">{titre}</h1>
      <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
        <p className="text-[13px] font-medium text-foreground">Bientôt disponible</p>
        <p className="text-[12px] text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}

export const PrestataireContactsView = () => <PortailPrestatairePlaceholder titre="Contacts & Interlocuteurs" description="Vos interlocuteurs chez MedAssur et les organismes partenaires." />;
export const PrestataireLogistiqueView = () => <PortailPrestatairePlaceholder titre="Logistique" description="Gestion des ressources et équipements de l'établissement." />;

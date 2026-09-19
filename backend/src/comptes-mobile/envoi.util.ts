// Message d'accès mobile (2026-08, texte factorisé ici pour être réutilisé
// tel quel côté écran — voir GenerationComptesMobileModal.tsx — et côté
// envoi réel, voir ComptesMobileService.generer qui le passe désormais à
// MessagingService.envoyer (Zavu, SMS/WhatsApp réels, branché 2026-09).
export function construireMessageAcces(matricule: string, motDePasseTemporaire: string): string {
  return (
    `MedAssur — Vos accès mobile\n` +
    `Matricule : ${matricule}\n` +
    `Mot de passe temporaire : ${motDePasseTemporaire}\n` +
    `Connexion avec votre numéro de téléphone ou votre matricule. ` +
    `Ce mot de passe vous sera demandé de changer dès la première connexion.`
  );
}

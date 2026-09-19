-- Suppression du modèle "Devis" (2026-08) — voir demande utilisateur : "en
-- assurance maladie, le 'Devis' est en réalité ce qu'on appelle la
-- 'Cotation'... il faut donc faire disparaître Devis et ne garder Cotation."
-- Redondant avec Cotation (moteur de tarification réel, garanties/taux),
-- Devis n'était qu'une ébauche générique antérieure.
DROP TABLE "DevisOffre";
DROP TABLE "Devis";

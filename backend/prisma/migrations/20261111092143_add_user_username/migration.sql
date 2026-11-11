-- Pseudo de connexion rapide (2026-11) — voir demande utilisateur :
-- "rendre possible la connexion par un pseudo pour aller plus vite".
-- Facultatif et unique ; null = pas de pseudo configuré.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

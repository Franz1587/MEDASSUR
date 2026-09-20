import { Injectable } from "@nestjs/common";

// Stockage de fichiers (2026-09) — 100% disque local du VPS. Supabase
// Storage a été utilisé temporairement (déploiement Vercel envisagé, disque
// serverless non persistant) puis la base de données a migré vers un
// Postgres local sur le VPS (voir mémoire "project-deploiement-hostinger-
// vps") ; le stockage de fichiers restait sur Supabase jusqu'ici — voir
// demande utilisateur : "je ne comprends pas pourquoi tu déploies encore
// sur supabase... on déploie maintenant que sur github et sur postgres qui
// est sur le VPS". Les ~306 fichiers déjà présents (logos, photos,
// documents...) ont été rapatriés une fois vers uploads/ (voir script de
// migration, exécuté le 2026-09-20) avant cette coupure — plus aucun appel
// réseau vers Supabase depuis cette classe. `actif` reste à `false` en
// dur : chaque appelant (StorageService.actif ? upload Supabase : écriture
// disque) garde intact son repli disque déjà existant, jamais retouché ici
// — seule cette classe change.
// Signatures conservées à l'identique (même si les corps ne s'exécutent
// jamais, `actif` étant toujours `false`) pour ne toucher AUCUN des ~25
// appelants existants — chacun a déjà son repli disque local tout fait,
// voir leur bloc `if (this.storage.actif) { ... } else { fs.writeFile... }`.
@Injectable()
export class StorageService {
  get actif(): boolean {
    return false;
  }

  async upload(_categorie: string, _nomFichier: string, _buffer: Buffer, _contentType?: string): Promise<void> {
    throw new Error("StorageService inactif — jamais appelé (voir storage.actif).");
  }

  async download(_categorie: string, _nomFichier: string): Promise<Buffer | null> {
    return null;
  }

  async delete(_categorie: string, _nomFichier: string): Promise<void> {
    // no-op — jamais appelé (voir storage.actif).
  }

  publicUrl(_categorie: string, _nomFichier: string): string {
    return "";
  }

  async signedUrl(_categorie: string, _nomFichier: string, _expiresInSeconds = 3600): Promise<string | null> {
    return null;
  }
}

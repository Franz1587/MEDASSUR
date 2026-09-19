import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Abstraction de stockage de fichiers (2026-09) — voir demande utilisateur :
// déploiement Supabase + Vercel, "je veux les deux solutions" (backend
// hébergeable indifféremment sur un serveur classique à disque persistant
// OU sur du serverless). Remplace peu à peu les écritures directes
// `fs.writeFile`/`fs.unlink` sous `uploads/<catégorie>/<fichier>`
// (UPLOADS_ROOT, voir uploads-dir.util.ts) par Supabase Storage — un
// stockage réseau qui fonctionne à l'identique quel que soit l'hébergeur
// du backend, contrairement au disque local (perdu à chaque redéploiement
// serverless, et déjà source d'un bug vécu sur ce projet : voir
// uploads-dir.util.ts, "ça se réinitialise à chaque fois").
//
// Deux buckets seulement (pas un par catégorie) : `public-assets` pour les
// éléments de marque à faible sensibilité (logos, modèles de carte, pages
// de garde) — URL publique directe, utilisable telle quelle dans un <img
// src>. `private-files` pour tout le reste (photos d'assurés, documents
// médicaux, pièces jointes) — jamais d'URL publique, uniquement des URLs
// signées à durée limitée ou un téléchargement server-side. La catégorie
// d'origine (ex. "logos-entreprises") devient un simple préfixe de chemin
// à l'intérieur du bucket, pour rester lisible et compatible avec les noms
// de fichiers déjà stockés en base (ex. ParametresEntreprise.logo) — le
// chemin complet Storage se reconstruit à la volée : `${categorie}/${nomFichier}`.
const CATEGORIES_PUBLIQUES = new Set([
  "logos", "logos-clients", "logos-cotations", "logos-prospects", "logos-entreprises",
  "modeles-carte", "pages-garde-statistiques",
]);
const BUCKET_PUBLIC = "public-assets";
const BUCKET_PRIVE = "private-files";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient | null;

  constructor() {
    // Valeurs de repli codées en dur (2026-09) — voir demande utilisateur :
    // "déplacer les variables dans le code en attendant qu'on installe
    // Coolify". TEMPORAIRE, explicitement voulu malgré l'avertissement
    // donné (ces identifiants se retrouvent alors dans l'historique Git) :
    // la base de données est passée sur PostgreSQL local (voir VPS
    // .env DATABASE_URL/DIRECT_URL), mais le stockage de fichiers (logos,
    // photos, documents) reste sur Supabase Storage — signalé par l'outil
    // de supervision externe "Kodee" comme dépendance Supabase restante.
    // process.env garde la PRIORITÉ : dès que Coolify gérera ces secrets
    // proprement, il suffira de les y renseigner sans toucher ce fichier —
    // seul le repli codé en dur ci-dessous devra alors être retiré (et la
    // clé de service Supabase tournée, puisqu'elle aura transité par Git).
    const SUPABASE_URL_REPLI = "https://dbvsafsuqnghloahbmir.supabase.co";
    const SUPABASE_SERVICE_KEY_REPLI = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRidnNhZnN1cW5naGxvYWhibWlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyMTk3MCwiZXhwIjoyMTA0Njk3OTcwfQ.QfEfDRi_IrL7foNIV41GuH3NZ8duXRaW9d-dUBg-unU";
    const url = process.env.SUPABASE_URL || SUPABASE_URL_REPLI;
    const key = process.env.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY_REPLI;
    this.client = url && key ? createClient(url, key) : null;
    if (!this.client) {
      // Absence tolérée (2026-09) — tant que les variables ne sont pas
      // configurées (dev local sans Supabase), les appelants continuent
      // d'utiliser le disque local via UPLOADS_ROOT sans que cette classe
      // n'y touche : la migration des points d'appel se fait service par
      // service, jamais d'un coup, voir mémoire "project-deploiement-supabase".
      this.logger.warn("SUPABASE_URL/SUPABASE_SERVICE_KEY absents — StorageService inactif (repli attendu sur le disque local par l'appelant).");
    }
  }

  get actif(): boolean {
    return this.client !== null;
  }

  private bucket(categorie: string): string {
    return CATEGORIES_PUBLIQUES.has(categorie) ? BUCKET_PUBLIC : BUCKET_PRIVE;
  }

  async upload(categorie: string, nomFichier: string, buffer: Buffer, contentType?: string): Promise<void> {
    if (!this.client) throw new Error("StorageService non configuré.");
    const { error } = await this.client.storage.from(this.bucket(categorie)).upload(`${categorie}/${nomFichier}`, buffer, { contentType, upsert: true });
    if (error) throw error;
  }

  async download(categorie: string, nomFichier: string): Promise<Buffer | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.storage.from(this.bucket(categorie)).download(`${categorie}/${nomFichier}`);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(categorie: string, nomFichier: string): Promise<void> {
    if (!this.client) return;
    await this.client.storage.from(this.bucket(categorie)).remove([`${categorie}/${nomFichier}`]);
  }

  // URL publique directe — uniquement valable pour une catégorie du bucket
  // public-assets (voir CATEGORIES_PUBLIQUES) ; renvoie une chaîne vide si
  // le client n'est pas configuré ou si la catégorie est privée par erreur.
  publicUrl(categorie: string, nomFichier: string): string {
    if (!this.client || !CATEGORIES_PUBLIQUES.has(categorie)) return "";
    const { data } = this.client.storage.from(BUCKET_PUBLIC).getPublicUrl(`${categorie}/${nomFichier}`);
    return data.publicUrl;
  }

  // URL signée à durée limitée — pour servir un fichier PRIVÉ au frontend
  // sans jamais l'exposer publiquement (photos d'assurés, documents
  // médicaux...). `expiresInSeconds` court par défaut (1h) : régénérée à
  // chaque affichage plutôt que stockée, jamais persistée en base.
  async signedUrl(categorie: string, nomFichier: string, expiresInSeconds = 3600): Promise<string | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.storage.from(this.bucket(categorie)).createSignedUrl(`${categorie}/${nomFichier}`, expiresInSeconds);
    if (error) return null;
    return data.signedUrl;
  }
}

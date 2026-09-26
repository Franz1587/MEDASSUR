import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { ImportClientRowDto } from "./dto/import-clients.dto";
import { UPLOADS_ROOT } from "../uploads-dir.util";
import { StorageService } from "../storage/storage.service";
import { genererIdNumerique } from "../lib/numeric-id.util";
import { texteBrutDeCellule } from "../lib/excel-cell.util";
import { numeroPolice } from "../lib/police.util";

const UPLOADS_LOGOS_DIR = path.join(UPLOADS_ROOT, "logos-clients");

// Import en masse (2026-08) — en-têtes du modèle .xlsx téléchargeable,
// dans l'ordre. Le parsing relit les fichiers par CORRESPONDANCE D'EN-TÊTE
// (normalisée : minuscule, espaces compressés), pas par index de colonne —
// robuste si l'utilisateur réordonne/retire des colonnes facultatives.
const COLONNES_IMPORT_CLIENT: { header: string; key: keyof ImportClientRowDto }[] = [
  { header: "Nom", key: "nom" },
  { header: "Type (Entreprise ou Particulier)", key: "type" },
  { header: "Pays", key: "pays" },
  { header: "Contact", key: "contact" },
  { header: "Téléphone", key: "tel" },
  { header: "Email", key: "email" },
  { header: "Ville", key: "ville" },
  { header: "Adresse", key: "adresse" },
  { header: "Boîte postale", key: "boitePostale" },
  { header: "Catégorie morale", key: "categorieMorale" },
  { header: "Forme juridique", key: "formeJuridique" },
  { header: "RCCM", key: "rccm" },
  { header: "NIF", key: "nif" },
  { header: "Secteur d'activité", key: "secteurActivite" },
  { header: "Représentant - Nom", key: "representantNom" },
  { header: "Représentant - Fonction", key: "representantFonction" },
  { header: "Représentant - Téléphone", key: "representantTel" },
  { header: "Représentant - Email", key: "representantEmail" },
  { header: "Prénom (Particulier)", key: "prenom" },
  { header: "Date de naissance (JJ/MM/AAAA)", key: "dateNaissance" },
  { header: "Lieu de naissance", key: "lieuNaissance" },
  { header: "Sexe (M ou F)", key: "sexe" },
  { header: "Nationalité", key: "nationalite" },
  { header: "Profession", key: "profession" },
  { header: "Pièce d'identité - Type", key: "pieceIdentiteType" },
  { header: "Pièce d'identité - Numéro", key: "pieceIdentiteNumero" },
];

// Le "( … )" de chaque en-tête n'est qu'une indication (format attendu,
// exemple) — jamais exigé au caractère près (voir même correctif sur
// ContratsService/ImportService — un vrai fichier utilisateur avait ce
// texte d'aide altéré par un outil tiers, faisant échouer la
// reconnaissance d'une colonne entière).
function normaliserEntete(s: string): string {
  return s.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, "").trim().replace(/\s+/g, " ");
}

// Shapes the response to match what the frontend's Client type expects
// (a `contrats` count + cumulative `prime`), computed from the related
// Contrat rows rather than stored redundantly.
function withAggregates<T extends { contrats: { prime: unknown }[] }>(client: T) {
  const { contrats, ...rest } = client;
  return {
    ...rest,
    contrats: contrats.length,
    prime: contrats.reduce((sum, c) => sum + Number(c.prime), 0),
  };
}

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private normalize(v: string) {
    return v.trim().toLowerCase();
  }

  private normalizePhone(v: string) {
    return v.replace(/\s+/g, "").trim();
  }

  async findAll(compagnieId?: string) {
    const clients = await this.prisma.client.findMany({
      where: compagnieId ? { contrats: { some: { compagnieId } } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { contrats: { select: { prime: true } } },
    });
    return clients.map(withAggregates);
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { contrats: { select: { prime: true } } },
    });
    if (!client) throw new NotFoundException(`Client ${id} introuvable`);
    return withAggregates(client);
  }

  async create(dto: CreateClientDto) {
    // Seul `nom` est obligatoire (2026-09) — email/tel/type peuvent être
    // absents, voir demande utilisateur : "il ne faut pas rendre les
    // autres données obligatoire pour enregistrer... un souscripteur."
    const email = dto.email ? this.normalize(dto.email) : undefined;
    const tel = dto.tel ? this.normalizePhone(dto.tel) : undefined;
    const nom = this.normalize(dto.nom);

    const conditionsDoublon: Prisma.ClientWhereInput[] = [
      { nom: { equals: nom, mode: "insensitive" }, type: dto.type },
    ];
    if (email) conditionsDoublon.push({ email: { equals: email, mode: "insensitive" } });
    if (tel) conditionsDoublon.push({ tel });

    const existing = await this.prisma.client.findFirst({ where: { OR: conditionsDoublon } });

    if (existing) {
      throw new BadRequestException(
        "Ce souscripteur existe déjà. Recherchez-le puis rattachez vos contrats à sa fiche unique.",
      );
    }

    return this.prisma.client.create({
      data: {
        id: await this.genererIdClient(),
        ...dto,
        email,
        tel,
      },
    });
  }

  // Référence lisible (2026-08) — voir demande utilisateur : "je ne veux
  // pas ce type d'affichage : 05aa9c68-600d-4a8a-b063-4c2b62c3194c... il
  // faut... faire apparaître la bonne référence pour chaque type d'import."
  // Un premier correctif avait aligné les souscripteurs sur la convention
  // CTR-2026-XXXXXX du reste de l'application ; l'utilisateur a ensuite
  // demandé plus simple encore : "Est-ce que tu ne peux pas simplement
  // référencer les clients avec un code numérique. Exemple : 260145." —
  // donc AA (2 derniers chiffres de l'année) + un compteur séquentiel sur 4
  // chiffres (846605-style, voir prochainNumeroQuittance dans
  // documents.service.ts), jamais un fragment aléatoire. Compteur partagé
  // "client" dans CompteurDocument, incrémenté atomiquement — jamais remis
  // à zéro (le préfixe AA reflète simplement l'année de création, pas une
  // remise à zéro annuelle du compteur).
  private async genererIdClient(): Promise<string> {
    return genererIdNumerique(this.prisma, "client");
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.client.delete({ where: { id } });
    return { id };
  }

  // Même pattern que CompagniesService.uploadLogo/deleteLogo.
  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.findOne(id);
    if (!file) throw new BadRequestException("Aucun fichier reçu.");
    const ext = path.extname(file.originalname) || ".png";
    const filename = `${id}${ext.toLowerCase()}`;
    if (this.storage.actif) {
      await this.storage.upload("logos-clients", filename, file.buffer, file.mimetype);
    } else {
      await fs.promises.mkdir(UPLOADS_LOGOS_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(UPLOADS_LOGOS_DIR, filename), file.buffer);
    }
    await this.prisma.client.update({ where: { id }, data: { logo: filename } });
    return this.findOne(id);
  }

  async deleteLogo(id: string) {
    const c = await this.findOne(id);
    if (c.logo) {
      if (this.storage.actif) await this.storage.delete("logos-clients", c.logo);
      else await fs.promises.unlink(path.join(UPLOADS_LOGOS_DIR, c.logo)).catch(() => undefined);
    }
    await this.prisma.client.update({ where: { id }, data: { logo: null } });
    return this.findOne(id);
  }

  async findPortfolio(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        contrats: { include: { compagnie: true } },
      },
    });

    if (!client) throw new NotFoundException(`Client ${id} introuvable`);

    // Référence affichée = numéro de police (2026-09) — voir demande
    // utilisateur : "faire plutôt remonter le numéro de police compagnie
    // c'est ça la bonne information par rapport au contrat" — c.id est un
    // identifiant technique interne qui ressemble à un numéro de police
    // (généré par genererIdNumerique) mais n'en est pas un, voir le
    // commentaire sur Contrat.numeroPolice dans schema.prisma. Repli sur
    // l'id si le numéro de police n'a pas encore été attribué — `||` et non
    // `??` : des contrats existants portent une chaîne VIDE ("") plutôt que
    // null, que `??` laissait passer telle quelle (référence invisible).
    const portefeuille = client.contrats
      .map((c) => ({
        reference: numeroPolice(c),
        source: "Contrat",
        produit: c.branche,
        compagnie: c.compagnie.nom,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        statut: c.statut,
        prime: Number(c.prime),
      }))
      .sort((a, b) => a.reference.localeCompare(b.reference));
    const primeTotale = portefeuille.reduce((sum, c) => sum + c.prime, 0);
    const { contrats: _contrats, ...souscripteur } = client;

    return {
      souscripteur,
      resume: {
        totalContrats: portefeuille.length,
        primeTotale,
      },
      contrats: portefeuille,
    };
  }

  // ── Import en masse (2026-08) ────────────────────────────────────────
  // Voir demande utilisateur : "créer 50, 100, 1000 contrats" impraticable
  // un par un — modèle .xlsx téléchargeable, reparsable, aperçu (dry-run)
  // avant confirmation (voir ClientsController).

  async genererModeleImport(): Promise<Buffer> {
    const classeur = new ExcelJS.Workbook();
    const feuille = classeur.addWorksheet("Souscripteurs");
    feuille.columns = COLONNES_IMPORT_CLIENT.map((c) => ({ header: c.header, key: c.key, width: 26 }));
    feuille.getRow(1).font = { bold: true };
    // Exemple délibérément fictif (2026-08 — voir demande utilisateur :
    // "je viens de faire un test d'import de souscripteur, mais rien ne
    // remonte") : l'exemple utilisait "SOGARA", un VRAI souscripteur déjà
    // en base — quiconque testait l'import en réimportant le modèle tel
    // quel (sans le modifier) se voyait donc rejeté par le contrôle anti-
    // doublon (voir resoudreClient/messageConflitClient), avec 0 ligne
    // créée et un rejet facile à manquer dans l'aperçu. Un nom
    // manifestement fictif échoue proprement si laissé tel quel, plutôt
    // que de percuter une vraie fiche.
    feuille.addRow({
      nom: "EXEMPLE SOUSCRIPTEUR SARL (à remplacer)", type: "Entreprise", pays: "Gabon", contact: "Paul-Marie Ondo", tel: "+241 01 55 23 10",
      email: "contact@exemple.ga", ville: "Port-Gentil", categorieMorale: "Parapublique", secteurActivite: "Industrie pétrolière",
    });
    return classeur.xlsx.writeBuffer() as Promise<unknown> as Promise<Buffer>;
  }

  // Relit un fichier .xlsx uploadé (aperçu, dry-run — ne persiste rien) et
  // signale les doublons potentiels (email/tel/nom déjà en base) SANS
  // bloquer la ligne (motif informatif) — le blocage réel n'a lieu qu'à la
  // confirmation (voir importer() ci-dessous), qui relit la base à jour.
  async parseImportFile(buffer: Buffer): Promise<{ lignes: ImportClientRowDto[]; rejets: { ligne: number; nom: string; motif: string }[] }> {
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const feuille = classeur.worksheets[0];
    if (!feuille) throw new BadRequestException("Fichier illisible ou vide.");

    const enteteRow = feuille.getRow(1);
    const indexParCle = new Map<keyof ImportClientRowDto, number>();
    enteteRow.eachCell((cell, colNumber) => {
      const norm = normaliserEntete(String(cell.value ?? ""));
      const colonne = COLONNES_IMPORT_CLIENT.find((c) => normaliserEntete(c.header) === norm);
      if (colonne) indexParCle.set(colonne.key, colNumber);
    });
    if (!indexParCle.has("nom")) {
      throw new BadRequestException(`Colonne "Nom" introuvable — utilisez le modèle téléchargeable.`);
    }

    const lignes: ImportClientRowDto[] = [];
    const rejets: { ligne: number; nom: string; motif: string }[] = [];
    for (let r = 2; r <= feuille.rowCount; r++) {
      const row = feuille.getRow(r);
      const valeur = (cle: keyof ImportClientRowDto) => {
        const idx = indexParCle.get(cle);
        if (!idx) return undefined;
        return texteBrutDeCellule(row.getCell(idx).value);
      };
      const nom = valeur("nom");
      if (!nom) continue; // ligne vide, ignorée silencieusement
      const ligne = { nom } as unknown as Record<string, string | undefined>;
      for (const { key } of COLONNES_IMPORT_CLIENT) {
        if (key === "nom") continue;
        const v = valeur(key);
        if (v !== undefined) ligne[key] = v;
      }
      const ligneTypee = ligne as unknown as ImportClientRowDto;
      const doublon = await this.trouverDoublon(ligneTypee);
      if (doublon) rejets.push({ ligne: r, nom, motif: doublon });
      lignes.push(ligneTypee);
    }
    return { lignes, rejets };
  }

  private async trouverDoublon(ligne: ImportClientRowDto): Promise<string | null> {
    const email = ligne.email ? this.normalize(ligne.email) : undefined;
    const tel = ligne.tel ? this.normalizePhone(ligne.tel) : undefined;
    const nom = this.normalize(ligne.nom);
    const existing = await this.prisma.client.findFirst({
      where: {
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(tel ? [{ tel }] : []),
          { AND: [{ nom: { equals: nom, mode: "insensitive" as const } }, { type: ligne.type ?? "Entreprise" }] },
        ],
      },
    });
    return existing ? `Souscripteur déjà existant ("${existing.nom}") — ligne ignorée.` : null;
  }

  // Confirmation — crée réellement les lignes qui ne sont pas des doublons
  // (revérifiés ici, la base ayant pu changer depuis l'aperçu).
  async importer(rows: ImportClientRowDto[]): Promise<{ crees: number; rejets: { ligne: number; nom: string; motif: string }[] }> {
    let crees = 0;
    const rejets: { ligne: number; nom: string; motif: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const ligne = rows[i];
      if (!ligne.nom?.trim()) { rejets.push({ ligne: i + 1, nom: "", motif: "Nom manquant." }); continue; }
      const doublon = await this.trouverDoublon(ligne);
      if (doublon) { rejets.push({ ligne: i + 1, nom: ligne.nom, motif: doublon }); continue; }
      await this.prisma.client.create({
        data: {
          id: await this.genererIdClient(),
          nom: ligne.nom,
          type: ligne.type === "Particulier" ? "Particulier" : "Entreprise",
          pays: ligne.pays || "Gabon",
          contact: ligne.contact || ligne.nom,
          tel: ligne.tel ? this.normalizePhone(ligne.tel) : "",
          email: ligne.email ? this.normalize(ligne.email) : "",
          statut: "Actif",
          ville: ligne.ville, adresse: ligne.adresse, boitePostale: ligne.boitePostale,
          categorieMorale: ligne.categorieMorale, formeJuridique: ligne.formeJuridique,
          rccm: ligne.rccm, nif: ligne.nif, secteurActivite: ligne.secteurActivite,
          representantNom: ligne.representantNom, representantFonction: ligne.representantFonction,
          representantTel: ligne.representantTel, representantEmail: ligne.representantEmail,
          prenom: ligne.prenom, dateNaissance: ligne.dateNaissance, lieuNaissance: ligne.lieuNaissance,
          sexe: ligne.sexe, nationalite: ligne.nationalite, profession: ligne.profession,
          pieceIdentiteType: ligne.pieceIdentiteType, pieceIdentiteNumero: ligne.pieceIdentiteNumero,
        },
      });
      crees++;
    }
    return { crees, rejets };
  }
}

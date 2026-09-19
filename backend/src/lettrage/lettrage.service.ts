import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { lettrerCompte, type MouvementALettrer } from "./lettrage.util";

// Lettrage interne à une société — comptes CLIENTS (souscripteurs) et
// FOURNISSEURS (prestataires) — 2026-09. Voir demande utilisateur : "en
// fonction des informations réelles des clients et fournisseurs, il faut
// que l'outil IA puisse également faire un vrai lettrage de compte", puis
// "les informations doivent être uniques" — réutilise le MÊME moteur
// lettrerCompte() que le lettrage du compte 411 côté Super Admin
// (FactureAbonnementService.lettrageClients), jamais une logique divergente.
@Injectable()
export class LettrageService {
  constructor(private readonly prisma: PrismaService) {}

  // Côté client (souscripteur) : débits = prime de chaque Exercice du
  // contrat (l'engagement de payer, à sa date d'effet — base SYSCOHADA
  // accrual, cohérente avec etatTaxes() côté plateforme) ; crédits =
  // chaque EncaissementPrime réel (dateEncaissement).
  //
  // Cas particulier Quittance Libre (paiement échelonné) — un contrat sous
  // plan de quittancement n'a PAS son prime d'exercice réglée en un seul
  // encaissement : voir model QuittanceLibre. Pour un tel contrat, les
  // débits deviennent les tranches elles-mêmes (QuittanceLibreTranche.
  // montant, à dateEcheance) plutôt que la prime globale de l'exercice —
  // sans quoi chaque tranche payée isolément ne matcherait jamais le
  // montant total de l'exercice. Et comme plusieurs tranches d'un même
  // plan partagent souvent EXACTEMENT le même montant (échéances égales),
  // un simple appariement par montant pourrait lettrer la mauvaise tranche
  // (ex. la plus ancienne au lieu de celle réellement réglée) : chaque
  // tranche porte un lien explicite et fiable vers son encaissement
  // (QuittanceLibreTranche.encaissementId) dès qu'elle est payée — utilisé
  // ici comme "paire connue", prioritaire sur la devinette par montant
  // (voir lettrerCompte()).
  async lettrageClients() {
    const clients = await this.prisma.client.findMany({
      select: {
        id: true,
        nom: true,
        contrats: {
          select: {
            id: true,
            numeroPolice: true,
            exercices: { select: { id: true, numero: true, dateDebut: true, prime: true } },
            encaissements: { select: { id: true, montant: true, dateEncaissement: true, modePaiement: true, trancheQuittanceLibre: { select: { id: true } } } },
            quittancesLibres: {
              select: {
                id: true,
                tranches: { select: { id: true, numero: true, montant: true, dateEcheance: true, encaissementId: true, encaissement: { select: { id: true, montant: true, dateEncaissement: true, modePaiement: true } } } },
              },
            },
          },
        },
      },
    });

    const resultats = clients
      .filter((c) => c.contrats.some((ct) => ct.exercices.length > 0 || ct.encaissements.length > 0))
      .map((c) => {
        const mouvements: MouvementALettrer[] = [];
        const pairesConnues: [MouvementALettrer, MouvementALettrer][] = [];

        for (const ct of c.contrats) {
          const sousQuittancement = ct.quittancesLibres.length > 0;

          // Débits : primes des exercices, SAUF si ce contrat est sous
          // plan de quittancement (ses tranches en tiennent lieu ci-dessous).
          if (!sousQuittancement) {
            for (const ex of ct.exercices) {
              mouvements.push({
                id: `ex-${ex.id}`,
                date: ex.dateDebut,
                libelle: `Prime exercice n°${ex.numero} — police ${ct.numeroPolice ?? ct.id}`,
                montant: Number(ex.prime),
              });
            }
          }

          for (const ql of ct.quittancesLibres) {
            for (const tr of ql.tranches) {
              const debit: MouvementALettrer = {
                id: `tr-${tr.id}`,
                date: tr.dateEcheance,
                libelle: `Tranche n°${tr.numero} — quittance libre — police ${ct.numeroPolice ?? ct.id}`,
                montant: Number(tr.montant),
              };
              if (tr.encaissementId && tr.encaissement) {
                const credit: MouvementALettrer = {
                  id: `enc-${tr.encaissement.id}`,
                  date: tr.encaissement.dateEncaissement,
                  libelle: `Règlement tranche n°${tr.numero}${tr.encaissement.modePaiement ? " — " + tr.encaissement.modePaiement : ""} — police ${ct.numeroPolice ?? ct.id}`,
                  montant: -Number(tr.encaissement.montant),
                };
                pairesConnues.push([debit, credit]);
              } else {
                mouvements.push(debit);
              }
            }
          }

          // Crédits hors plan de quittancement (déjà couverts ci-dessus via
          // trancheQuittanceLibre) — encaissements directs.
          for (const enc of ct.encaissements) {
            if (enc.trancheQuittanceLibre) continue;
            mouvements.push({
              id: `enc-${enc.id}`,
              date: enc.dateEncaissement,
              libelle: `Encaissement prime${enc.modePaiement ? " — " + enc.modePaiement : ""} — police ${ct.numeroPolice ?? ct.id}`,
              montant: -Number(enc.montant),
            });
          }
        }
        return { clientId: c.id, clientNom: c.nom, ...lettrerCompte(mouvements, pairesConnues) };
      });

    return resultats.sort((a, b) => Math.abs(b.soldeNonLettre) - Math.abs(a.soldeNonLettre));
  }

  async lettrageClient(clientId: string) {
    const toutes = await this.lettrageClients();
    return toutes.find((r) => r.clientId === clientId) ?? null;
  }

  // Côté fournisseur (prestataire) : débits = montant validé (ou à défaut
  // total) de chaque BordereauReglement à sa réception ; crédits = ce MÊME
  // montant à sa date de paiement, dès que le bordereau est "Payé" — que le
  // règlement soit intervenu seul ou groupé avec d'autres bordereaux du
  // même prestataire dans une même LettreCheque (voir model LettreCheque),
  // le montant PORTÉ PAR CE BORDEREAU reste inchangé : chaque bordereau
  // s'auto-solde par construction dès qu'il passe "Payé", d'où un
  // appariement quasi-systématiquement 1:1 (cf. commentaire de
  // lettrage.util.ts).
  async lettrageFournisseurs() {
    const bordereaux = await this.prisma.bordereauReglement.findMany({
      select: {
        id: true,
        numero: true,
        prestataireId: true,
        prestataire: { select: { nom: true } },
        montantTotal: true,
        montantValide: true,
        statut: true,
        dateReception: true,
        datePaiement: true,
      },
    });

    const parPrestataire = new Map<string, { prestataireId: string; prestataireNom: string; mouvements: MouvementALettrer[] }>();
    for (const b of bordereaux) {
      if (!parPrestataire.has(b.prestataireId)) {
        parPrestataire.set(b.prestataireId, { prestataireId: b.prestataireId, prestataireNom: b.prestataire.nom, mouvements: [] });
      }
      const g = parPrestataire.get(b.prestataireId)!;
      const montant = Number(b.montantValide ?? b.montantTotal);
      g.mouvements.push({ id: `${b.id}-du`, date: b.dateReception, libelle: `Bordereau n°${b.numero}`, montant });
      if (b.statut === "Payé" && b.datePaiement) {
        g.mouvements.push({ id: `${b.id}-cr`, date: b.datePaiement, libelle: `Règlement bordereau n°${b.numero}`, montant: -montant });
      }
    }

    return [...parPrestataire.values()]
      .map((g) => ({ prestataireId: g.prestataireId, prestataireNom: g.prestataireNom, ...lettrerCompte(g.mouvements) }))
      .sort((a, b) => Math.abs(b.soldeNonLettre) - Math.abs(a.soldeNonLettre));
  }

  async lettrageFournisseur(prestataireId: string) {
    const tous = await this.lettrageFournisseurs();
    return tous.find((r) => r.prestataireId === prestataireId) ?? null;
  }
}

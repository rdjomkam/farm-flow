/**
 * Queries pour le bon de livraison (BonLivraison) — Sprint BL, Story BL.3 ;
 * fusion quantites/signature — Sprint BF, Story BF.2.
 *
 * Un bon de livraison est cree a partir d'une vente EN_PREPARATION (relation
 * 1:1). Les quantites reellement livrees sont saisies par ligne (LigneBonLivraison,
 * Sprint BF) avant signature via `enregistrerQuantitesBonLivraison`. La
 * signature (`signerBonLivraison`) applique ces quantites : creation des
 * MORTALITE avaries, decrement des LigneVente/releves, passage BL -> SIGNE
 * et vente -> LIVREE, en une seule transaction.
 */

import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import {
  verifyAssignationInvariant,
  captureEcartsAssignation,
} from "@/lib/guards/assignation-invariant";
import { ValidationError } from "@/lib/errors";
import { StatutBonLivraison, StatutVente, TypeReleve, CauseMortalite } from "@/types";
import type {
  SignerBonLivraisonDTO,
  EnregistrerQuantitesBonLivraisonDTO,
  BlocPaiementBonLivraison,
} from "@/types";

/**
 * Type pour un client Prisma transactionnel (ou le client racine, structurellement
 * compatible pour les operations utilisees ici).
 */
type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/** Include standard pour un bon de livraison (detail) — inclut les lignes (Sprint BF) */
const BON_LIVRAISON_INCLUDE = {
  vente: {
    include: {
      client: true,
    },
  },
  user: { select: { id: true, name: true } },
  lignes: true,
} as const;

// ---------------------------------------------------------------------------
// ensureLignesBonLivraison — helper partage (creation + rattrapage legacy)
// ---------------------------------------------------------------------------

/**
 * Garantit qu'un bon de livraison possede une `LigneBonLivraison` par ligne
 * de vente, prereplie avec le poids commande. Ne fait rien si des lignes
 * existent deja (idempotent).
 *
 * Sert a la fois a la creation normale et au rattrapage des BL legacy (crees
 * avant Sprint BF, sans LigneBonLivraison — ex: BL-2026-001 en prod).
 */
async function ensureLignesBonLivraison(
  tx: PrismaTransactionClient,
  bonLivraisonId: string,
  siteId: string,
  lignesVente: { id: string; poidsTotalKg: number }[]
): Promise<void> {
  if (lignesVente.length === 0) return;

  const existingCount = await tx.ligneBonLivraison.count({
    where: { bonLivraisonId },
  });
  if (existingCount > 0) return;

  await tx.ligneBonLivraison.createMany({
    data: lignesVente.map((l) => ({
      bonLivraisonId,
      ligneVenteId: l.id,
      poidsLivreKg: l.poidsTotalKg,
      nombreMortsTransport: 0,
      siteId,
    })),
  });
}

// ---------------------------------------------------------------------------
// createBonLivraison
// ---------------------------------------------------------------------------

/**
 * Cree un bon de livraison a partir d'une vente.
 *
 * Regles metier :
 * 1. La vente doit exister et appartenir au site
 * 2. La vente doit etre au statut EN_PREPARATION
 * 3. Idempotent : si un BL existe deja pour cette vente, on le retourne
 *    tel quel (pas d'erreur, pas de doublon — relation 1:1 unique en base).
 *    Rattrapage : si ce BL existant n'a aucune ligne (BL legacy pre-Sprint BF),
 *    on les cree a la volee.
 * 4. Une `LigneBonLivraison` est creee par `LigneVente`, prereplie avec le
 *    poids commande (`poidsLivreKg = ligneVente.poidsTotalKg`), 0 mort
 *    transport, aucun motif (Sprint BF).
 */
export async function createBonLivraison(
  siteId: string,
  userId: string,
  venteId: string
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: {
        bonLivraison: { select: { id: true } },
        lignes: { select: { id: true, poidsTotalKg: true } },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    // Idempotent : un BL existe deja pour cette vente -> le retourner
    if (vente.bonLivraison) {
      // Rattrapage : BL legacy sans LigneBonLivraison (ex: BL-2026-001 prod)
      await ensureLignesBonLivraison(tx, vente.bonLivraison.id, siteId, vente.lignes);

      return tx.bonLivraison.findUniqueOrThrow({
        where: { id: vente.bonLivraison.id },
        include: BON_LIVRAISON_INCLUDE,
      });
    }

    if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new ValidationError(
        "Le bon de livraison ne peut etre cree que pour une vente en preparation."
      );
    }

    const numero = await generateNextNumero(tx, "bonLivraison", "BL", siteId);

    // Prisma 7 prisma-client: split write + include into two calls
    const created = await tx.bonLivraison.create({
      data: {
        numero,
        venteId,
        statut: StatutBonLivraison.BROUILLON,
        userId,
        siteId,
      },
    });

    await ensureLignesBonLivraison(tx, created.id, siteId, vente.lignes);

    return tx.bonLivraison.findUniqueOrThrow({
      where: { id: created.id },
      include: BON_LIVRAISON_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// getBonLivraisonByVente
// ---------------------------------------------------------------------------

/**
 * Recupere le bon de livraison d'une vente avec le bloc paiement calcule
 * (total vente / paye a ce jour / reste a payer).
 *
 * Source du "paye" : Facture.montantPaye si une facture est liee a la vente,
 * sinon 0 (aucun paiement possible sans facture).
 *
 * Rattrapage defensif (Sprint BF) : si le BL n'a aucune `LigneBonLivraison`
 * (BL legacy pre-Sprint BF), on les cree a la volee pour que le flux ne
 * plante jamais en ouvrant un BL ancien.
 */
export async function getBonLivraisonByVente(siteId: string, venteId: string) {
  const vente = await prisma.vente.findFirst({
    where: { id: venteId, siteId },
    include: {
      client: true,
      facture: { select: { id: true, montantPaye: true } },
      bonLivraison: { include: BON_LIVRAISON_INCLUDE },
      lignes: {
        include: {
          vague: { select: { code: true } },
          bac: { select: { nom: true } },
        },
      },
    },
  });
  if (!vente) throw new Error("Vente introuvable");

  if (!vente.bonLivraison) {
    return null;
  }

  let bonLivraison = vente.bonLivraison;
  if (bonLivraison.lignes.length === 0 && vente.lignes.length > 0) {
    await ensureLignesBonLivraison(
      prisma,
      bonLivraison.id,
      siteId,
      vente.lignes.map((l) => ({ id: l.id, poidsTotalKg: l.poidsTotalKg }))
    );
    bonLivraison = await prisma.bonLivraison.findUniqueOrThrow({
      where: { id: bonLivraison.id },
      include: BON_LIVRAISON_INCLUDE,
    });
  }

  const totalVente = vente.montantTotal;
  const paye = vente.facture ? vente.facture.montantPaye : 0;
  const resteAPayer = Math.max(0, totalVente - paye);

  const blocPaiement: BlocPaiementBonLivraison = {
    totalVente,
    paye,
    resteAPayer,
  };

  return {
    bonLivraison,
    vente,
    blocPaiement,
  };
}

// ---------------------------------------------------------------------------
// getBonLivraisonForPDF
// ---------------------------------------------------------------------------

/** Include pour la generation du PDF : lignes vente + assets promoteur du site */
const BON_LIVRAISON_PDF_INCLUDE = {
  vente: {
    include: {
      client: true,
      facture: { select: { id: true, montantPaye: true } },
      lignes: {
        include: {
          vague: { select: { code: true } },
          bac: { select: { nom: true } },
          lotAlevins: { select: { code: true } },
        },
      },
    },
  },
  lignes: true,
  user: { select: { id: true, name: true } },
  site: {
    select: {
      name: true,
      address: true,
      signaturePromoteur: true,
      nomPromoteur: true,
      cachet: true,
    },
  },
} as const;

/**
 * Recupere un bon de livraison par son id (avec toutes les donnees
 * necessaires au rendu PDF : lignes vente, bloc paiement, assets site).
 * Retourne `null` si introuvable ou si le BL n'appartient pas au site.
 */
export async function getBonLivraisonForPDF(siteId: string, id: string) {
  const bonLivraison = await prisma.bonLivraison.findFirst({
    where: { id, siteId },
    include: BON_LIVRAISON_PDF_INCLUDE,
  });
  if (!bonLivraison) return null;

  const totalVente = bonLivraison.vente.montantTotal;
  const paye = bonLivraison.vente.facture
    ? bonLivraison.vente.facture.montantPaye
    : 0;
  const resteAPayer = Math.max(0, totalVente - paye);

  const blocPaiement: BlocPaiementBonLivraison = {
    totalVente,
    paye,
    resteAPayer,
  };

  return { bonLivraison, blocPaiement };
}

// ---------------------------------------------------------------------------
// enregistrerQuantitesBonLivraison
// ---------------------------------------------------------------------------

/**
 * Enregistre les quantites reellement livrees d'un bon de livraison, avant
 * signature (ecran 1 du flux — Sprint BF).
 *
 * Regles metier :
 * 1. Le BL doit exister, appartenir au site, et etre BROUILLON ou
 *    EN_ATTENTE_SIGNATURE (jamais SIGNE — immuable une fois signe).
 * 2. La vente liee doit etre EN_PREPARATION.
 * 3. Chaque ligne du DTO doit referencer une ligne de la vente ;
 *    poidsLivreKg >= 0 ; nombreMortsTransport >= 0 et <= nombrePoissons.
 * 4. Transaction atomique (R4) : upsert des LigneBonLivraison, persiste
 *    dateLivraison sur le BL, statut -> EN_ATTENTE_SIGNATURE.
 *
 * Aucune ecriture sur LigneVente/Releve/Vente/Facture ici : ces quantites
 * sont un brouillon reversible tant que le BL n'est pas signe.
 */
export async function enregistrerQuantitesBonLivraison(
  siteId: string,
  userId: string,
  bonLivraisonId: string,
  dto: EnregistrerQuantitesBonLivraisonDTO
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void userId; // reserve pour audit futur (pas de SiteAuditLog ecrit ici)

  return prisma.$transaction(async (tx) => {
    const bonLivraison = await tx.bonLivraison.findFirst({
      where: { id: bonLivraisonId, siteId },
      include: {
        vente: {
          include: {
            lignes: { select: { id: true, nombrePoissons: true } },
          },
        },
      },
    });
    if (!bonLivraison) throw new Error("Bon de livraison introuvable");

    if (bonLivraison.statut === StatutBonLivraison.SIGNE) {
      throw new ValidationError(
        "Un bon de livraison signé ne peut plus être modifié."
      );
    }

    if (bonLivraison.vente.statut !== StatutVente.EN_PREPARATION) {
      throw new ValidationError(
        "La vente doit être en préparation pour modifier les quantités livrées."
      );
    }

    for (const ligneDto of dto.lignes) {
      const ligneVente = bonLivraison.vente.lignes.find(
        (l) => l.id === ligneDto.ligneVenteId
      );
      if (!ligneVente) {
        throw new ValidationError(
          `Ligne de vente introuvable dans cette vente: ${ligneDto.ligneVenteId}`
        );
      }
      if (ligneDto.poidsLivreKg < 0) {
        throw new ValidationError(
          `poidsLivreKg de la ligne ${ligneDto.ligneVenteId} ne peut pas etre negatif`
        );
      }
      const morts = ligneDto.nombreMortsTransport ?? 0;
      if (morts < 0) {
        throw new ValidationError(
          `nombreMortsTransport de la ligne ${ligneDto.ligneVenteId} ne peut pas etre negatif`
        );
      }
      if (morts > ligneVente.nombrePoissons) {
        throw new ValidationError(
          `nombreMortsTransport (${morts}) ne peut pas depasser le nombre de poissons de la ligne (${ligneVente.nombrePoissons})`
        );
      }
    }

    for (const ligneDto of dto.lignes) {
      await tx.ligneBonLivraison.upsert({
        where: {
          bonLivraisonId_ligneVenteId: {
            bonLivraisonId,
            ligneVenteId: ligneDto.ligneVenteId,
          },
        },
        create: {
          bonLivraisonId,
          ligneVenteId: ligneDto.ligneVenteId,
          poidsLivreKg: ligneDto.poidsLivreKg,
          nombreMortsTransport: ligneDto.nombreMortsTransport ?? 0,
          motifAvarie: ligneDto.motifAvarie ?? null,
          siteId,
        },
        update: {
          poidsLivreKg: ligneDto.poidsLivreKg,
          nombreMortsTransport: ligneDto.nombreMortsTransport ?? 0,
          motifAvarie: ligneDto.motifAvarie ?? null,
        },
      });
    }

    await tx.bonLivraison.update({
      where: { id: bonLivraisonId },
      data: {
        dateLivraison: dto.dateLivraison ? new Date(dto.dateLivraison) : new Date(),
        statut: StatutBonLivraison.EN_ATTENTE_SIGNATURE,
      },
    });

    return tx.bonLivraison.findUniqueOrThrow({
      where: { id: bonLivraisonId },
      include: BON_LIVRAISON_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// signerBonLivraison
// ---------------------------------------------------------------------------

/**
 * Signe un bon de livraison (client + livreur) et livre la vente en une
 * seule transaction (Sprint BF — absorbe l'ancienne `cloturerVente`).
 *
 * Regles metier :
 * 1. Le BL doit exister, appartenir au site, et ne pas etre deja SIGNE.
 * 2. Le BL doit avoir des quantites saisies (LigneBonLivraison) — impossible
 *    de signer sans etre passe par `enregistrerQuantitesBonLivraison`.
 * 3. La vente doit etre EN_PREPARATION et avoir au moins une ligne.
 * 4. Pour chaque ligne (quantites lues depuis LigneBonLivraison) :
 *    - poidsLivreKg >= 0, nombreMortsTransport >= 0 et <= nombrePoissons
 *    - si nombreMortsTransport > 0 : decrement LigneVente.nombrePoissons,
 *      decrement du releve VENTE lie (+ ReleveModification tracee), creation
 *      d'un releve MORTALITE cause=AVARIE (venteId, bacId, nombreMorts) —
 *      logique avaries sprint AV strictement preservee, zero conversion kg->morts
 *    - sinon : LigneVente.poidsLivreKg seul est mis a jour
 * 5. Vente -> LIVREE, quantites/poids figes sur le commande et recalcules
 *    sur le livre, montantTotal recalcule.
 * 6. BL -> SIGNE, signeLe = now, signatures persistees.
 * 7. verifyAssignationInvariant sur les bacs impactes par une avarie.
 * 8. Facture mise a jour si liee. SiteAuditLog cree.
 */
export async function signerBonLivraison(
  siteId: string,
  userId: string,
  bonLivraisonId: string,
  dto: SignerBonLivraisonDTO
) {
  return prisma.$transaction(async (tx) => {
    const bonLivraison = await tx.bonLivraison.findFirst({
      where: { id: bonLivraisonId, siteId },
      include: {
        lignes: true,
        vente: {
          include: {
            facture: { select: { id: true } },
            vague: { select: { id: true, code: true, nombreInitial: true } },
            client: { select: { id: true, nom: true } },
            lignes: true,
          },
        },
      },
    });
    if (!bonLivraison) throw new Error("Bon de livraison introuvable");

    if (bonLivraison.statut === StatutBonLivraison.SIGNE) {
      throw new ValidationError("Ce bon de livraison est deja signe.");
    }

    if (bonLivraison.lignes.length === 0) {
      throw new ValidationError(
        "Saisissez les quantités livrées avant de faire signer."
      );
    }

    const vente = bonLivraison.vente;
    if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new Error("Cette vente est deja cloturee");
    }
    if (vente.lignes.length === 0) {
      throw new Error("Impossible de livrer une vente sans ligne");
    }

    const dateLivraison = bonLivraison.dateLivraison ?? new Date();

    // -------------------------------------------------------------------
    // GT.2 — pre-scan des lignes AVANT la boucle de traitement, pour capturer
    // les ecarts preexistants en toute premiere operation de bac de la
    // transaction (avant les ecritures ci-dessous). Seules les lignes avec
    // nombreMortsTransport > 0 modifient une quantite de bac (creation d'un
    // releve MORTALITE qui entre dans le replay du guard) ; une ligne sans
    // avarie ne touche a aucune quantite de bac et n'a donc pas besoin d'etre
    // dans bacsParVague. Si une future story ajoute une ecriture de quantite
    // de bac pour une ligne SANS avarie, il faudra etendre ce pre-scan (et
    // bacsParVague plus bas) pour l'inclure.
    const bacsParVaguePreScan = new Map<string, Set<string>>();
    for (const ligne of vente.lignes) {
      const ligneBL = bonLivraison.lignes.find((l) => l.ligneVenteId === ligne.id);
      const nombreMortsTransportPreScan = ligneBL?.nombreMortsTransport ?? 0;
      if (nombreMortsTransportPreScan > 0 && ligne.vagueId && ligne.bacId) {
        const set = bacsParVaguePreScan.get(ligne.vagueId) ?? new Set<string>();
        set.add(ligne.bacId);
        bacsParVaguePreScan.set(ligne.vagueId, set);
      }
    }
    const ecartsRefParVagueBL = new Map<string, Map<string, number>>();
    for (const [vagueId, bacIds] of bacsParVaguePreScan) {
      ecartsRefParVagueBL.set(
        vagueId,
        await captureEcartsAssignation(tx, siteId, vagueId, [...bacIds]),
      );
    }

    // -------------------------------------------------------------------
    // Traiter chaque ligne : quantites lues depuis LigneBonLivraison
    // -------------------------------------------------------------------
    let totalPoidsLivre = 0;
    let totalQuantiteLivree = 0;
    let totalNombreMorts = 0;
    // bacsParVague : accumule PENDANT la boucle ci-dessous (par ligne traitee).
    // Redondant avec bacsParVaguePreScan (memes criteres nombreMortsTransport
    // > 0) mais conserve pour la lisibilite locale de la boucle existante.
    const bacsParVague = new Map<string, Set<string>>();

    for (const ligne of vente.lignes) {
      const ligneBL = bonLivraison.lignes.find((l) => l.ligneVenteId === ligne.id);
      const poidsLivreLigne = ligneBL?.poidsLivreKg ?? ligne.poidsTotalKg;
      const nombreMortsTransport = ligneBL?.nombreMortsTransport ?? 0;

      if (poidsLivreLigne < 0) {
        throw new ValidationError(
          `poidsLivreKg de la ligne ${ligne.id} ne peut pas etre negatif`
        );
      }
      if (nombreMortsTransport < 0) {
        throw new ValidationError(
          `nombreMortsTransport de la ligne ${ligne.id} ne peut pas etre negatif`
        );
      }
      if (nombreMortsTransport > ligne.nombrePoissons) {
        throw new ValidationError(
          `nombreMortsTransport (${nombreMortsTransport}) ne peut pas depasser le nombre de poissons de la ligne (${ligne.nombrePoissons})`
        );
      }

      let nouveauNombrePoissons = ligne.nombrePoissons;

      if (nombreMortsTransport > 0) {
        nouveauNombrePoissons = ligne.nombrePoissons - nombreMortsTransport;

        // Decrementer la ligne de vente (poissons morts = ne comptent plus comme livres)
        await tx.ligneVente.update({
          where: { id: ligne.id },
          data: { nombrePoissons: nouveauNombrePoissons, poidsLivreKg: poidsLivreLigne },
        });

        // Mettre a jour le releve VENTE lie a cette ligne + tracer la modification
        if (ligne.bacId) {
          const venteReleve = await tx.releve.findFirst({
            where: { venteId: vente.id, bacId: ligne.bacId, typeReleve: TypeReleve.VENTE },
            select: { id: true, nombreVendus: true },
          });
          if (venteReleve) {
            const oldVendus = venteReleve.nombreVendus ?? 0;
            const newVendus = Math.max(0, oldVendus - nombreMortsTransport);
            await tx.releve.update({
              where: { id: venteReleve.id },
              data: { nombreVendus: newVendus, modifie: true },
            });
            await tx.releveModification.create({
              data: {
                releveId: venteReleve.id,
                userId,
                raison: "Avarie transport livraison",
                champModifie: "nombreVendus",
                ancienneValeur: String(oldVendus),
                nouvelleValeur: String(newVendus),
                siteId,
              },
            });
          }
        }

        // Releve MORTALITE cause=AVARIE : seule source de verite pour les morts transport
        await tx.releve.create({
          data: {
            date: dateLivraison,
            typeReleve: TypeReleve.MORTALITE,
            vagueId: ligne.vagueId,
            bacId: ligne.bacId,
            siteId,
            userId,
            nombreMorts: nombreMortsTransport,
            causeMortalite: CauseMortalite.AVARIE,
            venteId: vente.id,
            notes:
              ligneBL?.motifAvarie ??
              `Morts transport livraison vente ${vente.numero} — ${nombreMortsTransport} poissons`,
          },
        });

        if (ligne.vagueId && ligne.bacId) {
          const set = bacsParVague.get(ligne.vagueId) ?? new Set<string>();
          set.add(ligne.bacId);
          bacsParVague.set(ligne.vagueId, set);
        }
      } else {
        await tx.ligneVente.update({
          where: { id: ligne.id },
          data: { poidsLivreKg: poidsLivreLigne },
        });
      }

      totalPoidsLivre += poidsLivreLigne;
      totalQuantiteLivree += nouveauNombrePoissons;
      totalNombreMorts += nombreMortsTransport;
    }

    const newMontantTotal = totalPoidsLivre * vente.prixUnitaireKg;
    const quantiteLivree = totalQuantiteLivree;

    // Mettre a jour la vente
    await tx.vente.update({
      where: { id: vente.id },
      data: {
        statut: StatutVente.LIVREE,
        poidsCommandeKg: vente.poidsTotalKg,
        quantiteCommandee: vente.quantitePoissons,
        poidsLivreKg: totalPoidsLivre,
        quantiteLivree,
        poidsTotalKg: totalPoidsLivre,
        quantitePoissons: quantiteLivree,
        dateLivraison,
        montantTotal: newMontantTotal,
      },
    });

    // Signer le BL — R4 : updateMany conditionnel (pas deja SIGNE)
    const signResult = await tx.bonLivraison.updateMany({
      where: {
        id: bonLivraisonId,
        siteId,
        statut: { not: StatutBonLivraison.SIGNE },
      },
      data: {
        statut: StatutBonLivraison.SIGNE,
        signatureClient: dto.signatureClient,
        signataireClientNom: dto.signataireClientNom,
        signatureLivreur: dto.signatureLivreur,
        signeLe: new Date(),
      },
    });
    if (signResult.count === 0) {
      throw new ValidationError("Ce bon de livraison est deja signe.");
    }

    // Guard : verifier l'invariant AssignationBac sur les bacs impactes par une avarie
    // — apres les updates de ligne, avant la relecture finale
    for (const [vagueId, bacIds] of bacsParVague) {
      await verifyAssignationInvariant(
        tx,
        siteId,
        vagueId,
        [...bacIds],
        ecartsRefParVagueBL.get(vagueId),
      );
    }

    // Mettre a jour la facture si elle existe — avant la relecture finale, au
    // cas ou BON_LIVRAISON_INCLUDE viendrait a inclure la facture un jour.
    if (vente.facture) {
      await tx.facture.update({
        where: { id: vente.facture.id },
        data: { montantTotal: newMontantTotal },
      });
    }

    // Prisma 7 prisma-client: split write + include into two calls
    const updated = await tx.bonLivraison.findUniqueOrThrow({
      where: { id: bonLivraisonId },
      include: BON_LIVRAISON_INCLUDE,
    });

    // Codes vagues sources pour l'audit log
    const vagueIds = [...new Set(vente.lignes.map((l) => l.vagueId))];

    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "VENTE_CLOTUREE",
        details: {
          bonLivraisonNumero: bonLivraison.numero,
          signataireClientNom: dto.signataireClientNom,
          venteNumero: vente.numero,
          clientNom: vente.client.nom,
          vagueIds,
          poidsCommande: vente.poidsTotalKg,
          poidsLivre: totalPoidsLivre,
          pertePoids: vente.poidsTotalKg - totalPoidsLivre,
          quantiteCommandee: vente.quantitePoissons,
          quantiteLivree,
          nombreMortsTransport: totalNombreMorts,
          ancienMontant: vente.montantTotal,
          nouveauMontant: newMontantTotal,
          dateLivraison: dateLivraison.toISOString(),
        },
      },
    });

    return updated;
  });
}

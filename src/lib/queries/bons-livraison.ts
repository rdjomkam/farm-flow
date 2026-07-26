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
import {
  StatutBonLivraison,
  StatutVente,
  StatutFacture,
  TypeReleve,
  CauseMortalite,
} from "@/types";
import type {
  SignerBonLivraisonDTO,
  EnregistrerQuantitesBonLivraisonDTO,
  CreerBonLivraisonRectificatifDTO,
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
// getBonLivraisonActif — BF.6b : helper central de la notion de "BL actif"
// ---------------------------------------------------------------------------

/**
 * Recupere le bon de livraison ACTIF d'une vente : celui dont `rectifiePar`
 * est `null` (BF.6a). Une vente peut porter plusieurs BonLivraison au fil du
 * temps (rectifications successives), mais un seul est actif — les autres
 * sont des documents historiques annules et remplaces.
 *
 * Toute la logique de « le » BL d'une vente doit passer par ce helper plutot
 * que d'interroger directement `vente.bonsLivraison` (relation en tableau).
 * Retourne `null` si la vente n'a aucun BL actif (ou si la vente n'appartient
 * pas au site).
 */
export async function getBonLivraisonActif(
  tx: PrismaTransactionClient | typeof prisma,
  siteId: string,
  venteId: string
) {
  return tx.bonLivraison.findFirst({
    where: { venteId, siteId, rectifiePar: { is: null } },
    include: BON_LIVRAISON_INCLUDE,
  });
}

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
 * 3. Idempotent : si un BL ACTIF (BF.6b — `rectifiePar` null) existe deja pour
 *    cette vente, on le retourne tel quel (pas d'erreur, pas de doublon). Les
 *    BL rectifies (historiques) ne comptent pas pour cette idempotence : une
 *    vente rouverte apres rectification recree/retrouve le BL en cours, pas
 *    l'ancien.
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
        lignes: { select: { id: true, poidsTotalKg: true } },
      },
    });
    if (!vente) throw new Error("Vente introuvable");

    // Idempotent : un BL ACTIF existe deja pour cette vente -> le retourner
    const bonLivraisonActif = await getBonLivraisonActif(tx, siteId, venteId);
    if (bonLivraisonActif) {
      // Rattrapage : BL legacy sans LigneBonLivraison (ex: BL-2026-001 prod)
      await ensureLignesBonLivraison(tx, bonLivraisonActif.id, siteId, vente.lignes);

      return tx.bonLivraison.findUniqueOrThrow({
        where: { id: bonLivraisonActif.id },
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
 * Recupere le bon de livraison ACTIF (BF.6b) d'une vente avec le bloc
 * paiement calcule (total vente / paye a ce jour / reste a payer).
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
      lignes: {
        include: {
          vague: { select: { code: true } },
          bac: { select: { nom: true } },
        },
      },
    },
  });
  if (!vente) throw new Error("Vente introuvable");

  const bonLivraisonActifInitial = await getBonLivraisonActif(prisma, siteId, venteId);
  if (!bonLivraisonActifInitial) {
    return null;
  }

  let bonLivraison = bonLivraisonActifInitial;
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
  // BF.7c — distinguer un rectificatif d'un bon annule dans le PDF
  rectifie: { select: { numero: true, signeLe: true } },
  rectifiePar: { select: { numero: true, signeLe: true } },
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
// getHistoriqueBonsLivraison — BF.7 phase 2 : sortir la requete de la page
// ---------------------------------------------------------------------------

/**
 * Recupere l'historique des bons de livraison rectifies (non actifs, `rectifiePar`
 * non null) d'une vente, du plus recent au plus ancien.
 *
 * Auparavant fait via un `prisma.bonLivraison.findMany` directement dans la
 * page serveur `src/app/(farm)/ventes/[id]/page.tsx` (contournement de la
 * couche queries et du filtrage `siteId` centralise, R8) — corrige ici.
 *
 * Inclut le numero du BL qui a remplace chaque entree (via `rectifiePar`),
 * pour afficher « remplace par BL-XXX » plutot qu'un simple badge.
 */
export async function getHistoriqueBonsLivraison(siteId: string, venteId: string) {
  return prisma.bonLivraison.findMany({
    where: { venteId, siteId, rectifiePar: { isNot: null } },
    select: {
      id: true,
      numero: true,
      signeLe: true,
      motifRectification: true,
      rectifiePar: { select: { numero: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
 * 2. La vente liee doit etre EN_PREPARATION — SAUF pour un rectificatif
 *    (`rectifieId` non null, Sprint BF phase 2) : dans ce cas la vente est
 *    deja LIVREE (elle l'a ete par le BL d'origine) et le reste tel quel
 *    jusqu'a la signature du rectificatif.
 * 3. Chaque ligne du DTO doit referencer une ligne de la vente ;
 *    poidsLivreKg >= 0 ; nombreMortsTransport >= 0 et <= nombrePoissons
 *    (rectificatif : <= nombrePoissons courant + morts deja appliques par le
 *    BL rectifie, cf. `ligneVente.nombrePoissons` qui est deja decremente).
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
        rectifie: {
          include: { lignes: true },
        },
      },
    });
    if (!bonLivraison) throw new Error("Bon de livraison introuvable");

    if (bonLivraison.statut === StatutBonLivraison.SIGNE) {
      throw new ValidationError(
        "Un bon de livraison signé ne peut plus être modifié."
      );
    }

    const estRectificatif = bonLivraison.rectifieId != null;
    const venteEnCours = bonLivraison.vente.statut === StatutVente.EN_PREPARATION;
    const venteRectifiable =
      estRectificatif && bonLivraison.vente.statut === StatutVente.LIVREE;
    if (!venteEnCours && !venteRectifiable) {
      throw new ValidationError(
        "La vente doit être en préparation pour modifier les quantités livrées."
      );
    }

    const anciennesLignes = new Map(
      (bonLivraison.rectifie?.lignes ?? []).map((l) => [l.ligneVenteId, l])
    );

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
      const anciensMorts = estRectificatif
        ? anciennesLignes.get(ligneDto.ligneVenteId)?.nombreMortsTransport ?? 0
        : 0;
      const maxMorts = ligneVente.nombrePoissons + anciensMorts;
      if (morts > maxMorts) {
        throw new ValidationError(
          `nombreMortsTransport (${morts}) ne peut pas depasser le nombre de poissons de la ligne (${maxMorts})`
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
// creerBonLivraisonRectificatif
// ---------------------------------------------------------------------------

/**
 * Cree un bon de livraison rectificatif a partir d'un BL SIGNE (Sprint BF
 * phase 2, Story BF.7a) — corrige un document deja applique (stock,
 * mortalites, montants, facture) via le calcul de deltas a la signature.
 *
 * Regles metier :
 * 1. Le BL d'origine doit exister, appartenir au site, et etre SIGNE (on ne
 *    rectifie qu'un document signe).
 * 2. Le BL d'origine ne doit pas deja etre rectifie (`rectifiePar` null) —
 *    on ne rectifie que l'ACTIF, jamais un maillon deja remplace de la chaine.
 * 3. La vente doit etre LIVREE. Bloque explicitement si CLOTUREE (etat
 *    terminal — cf. `cloturerDefinitivement` / `regenererFacture`).
 * 4. `motifRectification` est obligatoire (valide en amont par Zod) et
 *    persiste sur le nouveau BL.
 *
 * Cree un nouveau BonLivraison (numero BL-YYYY-NNN suivant, statut
 * BROUILLON, `rectifieId` = id de l'origine) dont les LigneBonLivraison sont
 * PREREMPLIES depuis les lignes du BL d'ORIGINE (poids/morts/motif deja
 * signes), pas depuis les quantites commandees : on part de l'etat applique
 * pour le corriger. Le parcours reutilise ensuite l'existant :
 * `enregistrerQuantitesBonLivraison` puis `signerBonLivraison` (mode delta).
 */
export async function creerBonLivraisonRectificatif(
  siteId: string,
  userId: string,
  bonLivraisonOrigineId: string,
  dto: Pick<CreerBonLivraisonRectificatifDTO, "motifRectification">
) {
  return prisma.$transaction(async (tx) => {
    const origine = await tx.bonLivraison.findFirst({
      where: { id: bonLivraisonOrigineId, siteId },
      include: {
        lignes: true,
        rectifiePar: { select: { id: true } },
        vente: { select: { id: true, statut: true } },
      },
    });
    if (!origine) throw new Error("Bon de livraison introuvable");

    if (origine.statut !== StatutBonLivraison.SIGNE) {
      throw new ValidationError(
        "Seul un bon de livraison signé peut être rectifié."
      );
    }

    if (origine.rectifiePar) {
      throw new ValidationError(
        "Ce bon de livraison a déjà été rectifié : seul le bon de livraison actif peut être rectifié à nouveau."
      );
    }

    if (origine.vente.statut === StatutVente.CLOTUREE) {
      throw new ValidationError(
        "Impossible de rectifier le bon de livraison d'une vente clôturée définitivement."
      );
    }
    if (origine.vente.statut !== StatutVente.LIVREE) {
      throw new ValidationError(
        "Seule une vente livrée peut faire l'objet d'un bon de livraison rectificatif."
      );
    }

    const numero = await generateNextNumero(tx, "bonLivraison", "BL", siteId);

    // Prisma 7 prisma-client: split write + include into two calls
    const created = await tx.bonLivraison.create({
      data: {
        numero,
        venteId: origine.venteId,
        statut: StatutBonLivraison.BROUILLON,
        rectifieId: origine.id,
        motifRectification: dto.motifRectification,
        userId,
        siteId,
      },
    });

    if (origine.lignes.length > 0) {
      await tx.ligneBonLivraison.createMany({
        data: origine.lignes.map((l) => ({
          bonLivraisonId: created.id,
          ligneVenteId: l.ligneVenteId,
          poidsLivreKg: l.poidsLivreKg,
          nombreMortsTransport: l.nombreMortsTransport,
          motifAvarie: l.motifAvarie,
          siteId,
        })),
      });
    }

    return tx.bonLivraison.findUniqueOrThrow({
      where: { id: created.id },
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
 * Deux modes, selon que le BL est un rectificatif (`rectifieId` non null,
 * Sprint BF phase 2) ou non :
 *
 * MODE NORMAL (BL sans rectifieId) — comportement historique inchange :
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
 *
 * MODE RECTIFICATIF (BL.rectifieId != null, Sprint BF phase 2, Story BF.7a) —
 * l'etat est DEJA applique par le BL rectifie : on applique un DELTA calcule
 * par rapport a ce BL rectifie (jamais par rapport au premier maillon de la
 * chaine — sinon double comptage sur A ← B ← C) :
 * - LigneVente.poidsLivreKg = nouvelle valeur absolue
 * - LigneVente.nombrePoissons += (anciensMorts − nouveauxMorts)
 * - Releve VENTE.nombreVendus += (anciensMorts − nouveauxMorts), trace
 * - Releve MORTALITE cause=AVARIE de l'origine : mis a jour si nouveauxMorts
 *   > 0, supprime (tx.releve.delete direct — chemin sanctionne, cf. deleteReleve)
 *   si nouveauxMorts === 0, cree si l'origine n'en avait pas
 * - Vente reste LIVREE (jamais retransitionnee)
 *
 * Commun aux deux modes :
 * 6. BL -> SIGNE, signeLe = now, signatures persistees.
 * 7. verifyAssignationInvariant sur les bacs impactes (superset des deux BL
 *    en mode rectificatif — un bac peut sortir du perimetre si ses morts
 *    passent a 0).
 * 8. Facture mise a jour si liee (mode rectificatif : meme logique de statut
 *    que `regenererFacture` — PAYEE/PAYEE_PARTIELLEMENT, jamais de blocage
 *    si le deja-paye depasse le nouveau montant). SiteAuditLog cree.
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
        rectifiePar: { select: { id: true } },
        rectifie: { include: { lignes: true } },
        vente: {
          include: {
            facture: { select: { id: true, montantPaye: true, statut: true } },
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

    // BF.6b — un BL deja rectifie (remplace par un nouveau) ne peut plus etre
    // signe : la chaine de rectification se corromprait (deux BL "valides"
    // pour la meme vente).
    if (bonLivraison.rectifiePar) {
      throw new ValidationError(
        "Ce bon de livraison a ete rectifie et remplace : il ne peut plus etre signe."
      );
    }

    if (bonLivraison.lignes.length === 0) {
      throw new ValidationError(
        "Saisissez les quantités livrées avant de faire signer."
      );
    }

    const vente = bonLivraison.vente;
    // BF.7a — mode rectificatif : la vente est deja LIVREE (par le BL
    // d'origine) et le reste ; elle ne repasse jamais par EN_PREPARATION.
    const estRectificatif = bonLivraison.rectifieId != null;
    if (estRectificatif) {
      if (vente.statut !== StatutVente.LIVREE) {
        throw new ValidationError(
          "La vente doit être livrée pour appliquer un bon de livraison rectificatif."
        );
      }
    } else if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new Error("Cette vente est deja cloturee");
    }
    if (vente.lignes.length === 0) {
      throw new Error("Impossible de livrer une vente sans ligne");
    }

    // Etat applique par le BL rectifie (mode rectificatif uniquement) —
    // base du calcul de delta, JAMAIS le premier maillon de la chaine.
    const anciennesLignes = new Map(
      (bonLivraison.rectifie?.lignes ?? []).map((l) => [l.ligneVenteId, l])
    );

    const dateLivraison = bonLivraison.dateLivraison ?? new Date();

    // -------------------------------------------------------------------
    // GT.2 (etendu BF.7a) — pre-scan des lignes AVANT la boucle de
    // traitement, pour capturer les ecarts preexistants en toute premiere
    // operation de bac de la transaction (avant les ecritures ci-dessous).
    // Mode normal : seules les lignes avec nombreMortsTransport > 0
    // modifient une quantite de bac. Mode rectificatif : superset des deux
    // BL (anciens ET nouveaux morts > 0) — un bac peut sortir du perimetre
    // si ses morts passent a 0, mais reste "touche" par l'operation.
    const bacsParVaguePreScan = new Map<string, Set<string>>();
    for (const ligne of vente.lignes) {
      const ligneBL = bonLivraison.lignes.find((l) => l.ligneVenteId === ligne.id);
      const nombreMortsTransportPreScan = ligneBL?.nombreMortsTransport ?? 0;
      const anciensMortsPreScan = estRectificatif
        ? anciennesLignes.get(ligne.id)?.nombreMortsTransport ?? 0
        : 0;
      const toucheBacPreScan =
        nombreMortsTransportPreScan > 0 || anciensMortsPreScan > 0;
      if (toucheBacPreScan && ligne.vagueId && ligne.bacId) {
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
    // Redondant avec bacsParVaguePreScan (memes criteres) mais conserve pour
    // la lisibilite locale de la boucle existante.
    const bacsParVague = new Map<string, Set<string>>();

    for (const ligne of vente.lignes) {
      const ligneBL = bonLivraison.lignes.find((l) => l.ligneVenteId === ligne.id);
      const poidsLivreLigne = ligneBL?.poidsLivreKg ?? ligne.poidsTotalKg;
      const nombreMortsTransport = ligneBL?.nombreMortsTransport ?? 0;
      const anciensMorts = estRectificatif
        ? anciennesLignes.get(ligne.id)?.nombreMortsTransport ?? 0
        : 0;

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
      const maxMortsLigne = ligne.nombrePoissons + anciensMorts;
      if (nombreMortsTransport > maxMortsLigne) {
        throw new ValidationError(
          `nombreMortsTransport (${nombreMortsTransport}) ne peut pas depasser le nombre de poissons de la ligne (${maxMortsLigne})`
        );
      }

      let nouveauNombrePoissons = ligne.nombrePoissons;

      if (estRectificatif) {
        // ---------------------------------------------------------------
        // MODE DELTA — l'etat est deja applique par le BL rectifie.
        // ---------------------------------------------------------------
        const deltaMorts = anciensMorts - nombreMortsTransport;
        nouveauNombrePoissons = ligne.nombrePoissons + deltaMorts;

        await tx.ligneVente.update({
          where: { id: ligne.id },
          data: { nombrePoissons: nouveauNombrePoissons, poidsLivreKg: poidsLivreLigne },
        });

        if (ligne.bacId && deltaMorts !== 0) {
          const venteReleve = await tx.releve.findFirst({
            where: { venteId: vente.id, bacId: ligne.bacId, typeReleve: TypeReleve.VENTE },
            select: { id: true, nombreVendus: true },
          });
          if (venteReleve) {
            const oldVendus = venteReleve.nombreVendus ?? 0;
            const rawVendus = oldVendus + deltaMorts;
            if (rawVendus < 0) {
              // Durcissement review Sprint BF phase 2 — le clamp est conserve
              // (on ne transforme pas un cas limite benin en panne
              // production), mais son declenchement doit rester observable :
              // c'est le signe qu'un calcul de delta en amont est faux.
              console.warn(
                "[signerBonLivraison] clamp nombreVendus (mode rectificatif) : valeur negative absorbee",
                {
                  bonLivraisonId,
                  ligneVenteId: ligne.id,
                  oldVendus,
                  deltaMorts,
                  rawVendus,
                }
              );
            }
            const newVendus = Math.max(0, rawVendus);
            await tx.releve.update({
              where: { id: venteReleve.id },
              data: { nombreVendus: newVendus, modifie: true },
            });
            await tx.releveModification.create({
              data: {
                releveId: venteReleve.id,
                userId,
                raison: "Rectification bon de livraison",
                champModifie: "nombreVendus",
                ancienneValeur: String(oldVendus),
                nouvelleValeur: String(newVendus),
                siteId,
              },
            });
          }
        }

        // Releve MORTALITE cause=AVARIE de l'origine, lie a cette ligne (vente + bac)
        const releveMortaliteOrigine = ligne.bacId
          ? await tx.releve.findFirst({
              where: {
                venteId: vente.id,
                bacId: ligne.bacId,
                typeReleve: TypeReleve.MORTALITE,
                causeMortalite: CauseMortalite.AVARIE,
              },
            })
          : null;

        if (nombreMortsTransport > 0) {
          if (releveMortaliteOrigine) {
            const oldMorts = releveMortaliteOrigine.nombreMorts ?? 0;
            await tx.releve.update({
              where: { id: releveMortaliteOrigine.id },
              data: { nombreMorts: nombreMortsTransport, modifie: true },
            });
            await tx.releveModification.create({
              data: {
                releveId: releveMortaliteOrigine.id,
                userId,
                raison: "Rectification bon de livraison",
                champModifie: "nombreMorts",
                ancienneValeur: String(oldMorts),
                nouvelleValeur: String(nombreMortsTransport),
                siteId,
              },
            });
          } else {
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
                  `Morts transport livraison (rectificatif) vente ${vente.numero} — ${nombreMortsTransport} poissons`,
              },
            });
          }
        } else if (releveMortaliteOrigine) {
          // nouveauxMorts === 0 : les poissons reviennent, le releve
          // d'avarie n'a plus lieu d'etre — suppression directe (chemin
          // sanctionne du rectificatif, cf. protection deleteReleve).
          await tx.releve.delete({ where: { id: releveMortaliteOrigine.id } });
          await tx.siteAuditLog.create({
            data: {
              siteId,
              actorId: userId,
              action: "RELEVE_MORTALITE_SUPPRIME_RECTIFICATIF",
              details: {
                releveId: releveMortaliteOrigine.id,
                bonLivraisonNumero: bonLivraison.numero,
                venteNumero: vente.numero,
                bacId: ligne.bacId,
                ancienNombreMorts: releveMortaliteOrigine.nombreMorts,
              },
            },
          });
        }

        if (ligne.vagueId && ligne.bacId && (anciensMorts > 0 || nombreMortsTransport > 0)) {
          const set = bacsParVague.get(ligne.vagueId) ?? new Set<string>();
          set.add(ligne.bacId);
          bacsParVague.set(ligne.vagueId, set);
        }
      } else if (nombreMortsTransport > 0) {
        // ---------------------------------------------------------------
        // MODE NORMAL — valeurs absolues, rien n'est encore applique.
        // ---------------------------------------------------------------
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
            const rawVendus = oldVendus - nombreMortsTransport;
            if (rawVendus < 0) {
              // Durcissement review Sprint BF phase 2 — voir commentaire
              // equivalent en mode rectificatif ci-dessus.
              console.warn(
                "[signerBonLivraison] clamp nombreVendus (mode normal) : valeur negative absorbee",
                {
                  bonLivraisonId,
                  ligneVenteId: ligne.id,
                  oldVendus,
                  nombreMortsTransport,
                  rawVendus,
                }
              );
            }
            const newVendus = Math.max(0, rawVendus);
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

      // Review Sprint BF phase 2 (finding Haute) — snapshot du nombre de
      // poissons effectivement livres, fige AU MOMENT DE CETTE signature (les
      // deux modes ci-dessus aboutissent au meme `nouveauNombrePoissons`). Le
      // PDF lit ce champ en priorite : sans lui, regenerer le PDF d'un BL
      // d'origine apres une rectification affichait le nombre de poissons
      // *courant* de LigneVente (mutable, reecrit par le rectificatif) plutot
      // que celui constate a sa propre signature.
      if (ligneBL) {
        await tx.ligneBonLivraison.update({
          where: {
            bonLivraisonId_ligneVenteId: {
              bonLivraisonId,
              ligneVenteId: ligne.id,
            },
          },
          data: { nombrePoissonsLivres: nouveauNombrePoissons },
        });
      }

      totalPoidsLivre += poidsLivreLigne;
      totalQuantiteLivree += nouveauNombrePoissons;
      totalNombreMorts += nombreMortsTransport;
    }

    const newMontantTotal = totalPoidsLivre * vente.prixUnitaireKg;
    const quantiteLivree = totalQuantiteLivree;

    // Mettre a jour la vente — mode rectificatif : la vente reste LIVREE
    // (jamais retransitionnee) et poidsCommandeKg/quantiteCommandee/
    // dateLivraison (deja figes par le BL d'origine) ne sont pas touches.
    await tx.vente.update({
      where: { id: vente.id },
      data: estRectificatif
        ? {
            poidsLivreKg: totalPoidsLivre,
            quantiteLivree,
            poidsTotalKg: totalPoidsLivre,
            quantitePoissons: quantiteLivree,
            montantTotal: newMontantTotal,
          }
        : {
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
    // Mode rectificatif : meme logique de statut que `regenererFacture`
    // (src/lib/queries/factures.ts) — jamais de blocage si montantPaye > nouveauMontant.
    if (vente.facture) {
      if (estRectificatif) {
        const newStatut =
          vente.facture.montantPaye >= newMontantTotal
            ? StatutFacture.PAYEE
            : vente.facture.montantPaye > 0
              ? StatutFacture.PAYEE_PARTIELLEMENT
              : vente.facture.statut;
        await tx.facture.update({
          where: { id: vente.facture.id },
          data: { montantTotal: newMontantTotal, statut: newStatut },
        });
      } else {
        await tx.facture.update({
          where: { id: vente.facture.id },
          data: { montantTotal: newMontantTotal },
        });
      }
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
        action: estRectificatif ? "BON_LIVRAISON_RECTIFIE" : "VENTE_CLOTUREE",
        details: {
          bonLivraisonNumero: bonLivraison.numero,
          bonLivraisonOrigineNumero: bonLivraison.rectifie?.numero,
          motifRectification: bonLivraison.motifRectification,
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

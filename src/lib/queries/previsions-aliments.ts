/**
 * src/lib/queries/previsions-aliments.ts
 *
 * Queries Prisma — AlimentPrevision (le CALIBRE), AlimentArticlePrevision
 * (l'ARTICLE), RepartitionMoisAliment (Sprint PR2, story PR2.1 ; restructure
 * en modele a deux niveaux par l'amendement ADR-053 §12, Sprint PR2-quater).
 * Reference ADR-053, sections 3.5 et 12.
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture.
 * R4 : `replaceRepartitionsMoisAliment` valide "somme = 100%" (moteur,
 *      `validerSommeRepartitionMoisAliment`) ET ecrit (deleteMany + createMany)
 *      dans la MEME transaction (ADR-053 section 3.5, explicitement).
 *      `createAlimentPrevisionAvecArticle`/`addAlimentArticlePrevision` :
 *      meme discipline pour la creation calibre+article et la validation
 *      "somme des parts = 100%" (ADR-053 §12.2 arbitrage 3).
 * Piege Prisma 7 : `createAlimentPrevisionAvecArticle` cree l'AlimentPrevision
 *      (FK brute `scenarioId`) SANS include, puis recharge via
 *      `findUniqueOrThrow` + `include` — jamais `create({ data, include })`
 *      avec une FK brute.
 */
import { prisma } from "@/lib/db";
import { TailleGranule } from "@/types";
import {
  validerSommeRepartitionMoisAliment,
  validerSommeApprovisionnementArticles,
} from "@/lib/previsions/validation";
import { Decimal } from "@/lib/previsions/decimal-config";
import type { RepartitionMoisInput } from "@/lib/previsions/types";
import { ValidationError } from "@/lib/errors";

/**
 * Garde applicative — colonnes Prisma `Int` de ce module (`ordre`,
 * `moisCycle`). Meme raison d'etre que la garde homonyme de
 * `previsions-vagues.ts` : Prisma tronque silencieusement (`Math.trunc`,
 * sans exception) une valeur `number` fractionnaire ecrite dans une colonne
 * `Int`, verifie empiriquement contre un vrai Postgres (story PR2.1, cf.
 * `previsions-int-fractional-integration.test.ts`) — cette garde est la
 * seule protection reelle contre une corruption silencieuse.
 *
 * @throws {Error} si `valeur` n'est pas un entier.
 */
function assertEntierColonneInt(valeur: number, nomChamp: string): void {
  if (!Number.isInteger(valeur)) {
    throw new Error(
      `${nomChamp} doit etre un entier (colonne Prisma Int) — valeur recue : ${valeur}.`
    );
  }
}

/** Caracteristiques d'un article, telles que saisies (ADR-053 §12.3). */
export interface AlimentArticlePrevisionInputDTO {
  libelle: string;
  poidsSacKg: number;
  prixSacFCFA: number;
  produitId?: string | null;
  ordre?: number;
}

/**
 * DTO pour creer un calibre + son unique article, dans la MEME transaction
 * (ADR-053 §12.6 : "creer un calibre cree son article dans le meme geste").
 * `partApprovisionnementPct` de l'article cree n'apparait PAS ici : elle
 * vaut 100 implicitement, ecrite par le serveur (§12.6).
 */
export interface CreateAlimentPrevisionDTO {
  tailleGranule: TailleGranule;
  sacsParTonneStandard?: number | null;
  ordre?: number;
  article: AlimentArticlePrevisionInputDTO;
  /** Repartitions mensuelles initiales — optionnelles a la creation, remplacables ensuite via replaceRepartitionsMoisAliment */
  repartitions?: { moisCycle: number; pourcentage: number }[];
}

export interface UpdateAlimentPrevisionDTO {
  sacsParTonneStandard?: number | null;
  ordre?: number;
}

export interface RepartitionMoisAlimentInputDTO {
  moisCycle: number;
  pourcentage: number;
}

/**
 * DTO pour ajouter un second (ou N-ieme) article a un calibre existant —
 * action secondaire explicite (ADR-053 §12.6). `repartition` porte la part
 * COMPLETE de TOUS les articles du calibre apres ajout (celui deja existant
 * inclus) — jamais seulement la part du nouvel article.
 */
export interface AddAlimentArticlePrevisionDTO {
  nouvelArticle: AlimentArticlePrevisionInputDTO;
  /** un element par article du calibre APRES ajout ; `articleId` absent = le nouvelArticle */
  repartition: { articleId?: string; partApprovisionnementPct: number }[];
}

export interface UpdateAlimentArticlePrevisionDTO {
  libelle?: string;
  poidsSacKg?: number;
  prixSacFCFA?: number;
  produitId?: string | null;
  ordre?: number;
}

/** Calcule sacsParTonneUnitaire (1000 / poidsSacKg) — ratio d'unite pur (ERR-138). */
function calculerSacsParTonneUnitaire(poidsSacKg: number): Decimal {
  const p = new Decimal(poidsSacKg);
  return p.lte(0) ? new Decimal(0) : new Decimal(1000).dividedBy(p);
}

const ALIMENT_INCLUDE = {
  repartitions: { orderBy: { moisCycle: "asc" as const } },
  articles: { orderBy: { ordre: "asc" as const } },
};

/**
 * Liste les AlimentPrevision (calibres) d'un scenario, avec leurs
 * repartitions et articles inclus (evite le N+1).
 */
export async function getAlimentsPrevisionParScenario(scenarioId: string, siteId: string) {
  return prisma.alimentPrevision.findMany({
    where: { scenarioId, siteId },
    include: ALIMENT_INCLUDE,
    orderBy: { ordre: "asc" },
  });
}

/** Recupere un AlimentPrevision (calibre) par id avec ses repartitions et articles. */
export async function getAlimentPrevisionById(id: string, siteId: string) {
  return prisma.alimentPrevision.findFirst({
    where: { id, siteId },
    include: ALIMENT_INCLUDE,
  });
}

/**
 * Cree un calibre (AlimentPrevision) + son unique article
 * (AlimentArticlePrevision, `partApprovisionnementPct = 100`, ecrite par le
 * serveur — ADR-053 §12.6) + ses RepartitionMoisAliment optionnelles, DANS
 * UNE SEULE TRANSACTION — jamais deux appels non transactionnels (ADR-053
 * §12.6 : "creer un calibre cree son article dans le meme geste").
 */
export async function createAlimentPrevisionAvecArticle(
  scenarioId: string,
  siteId: string,
  data: CreateAlimentPrevisionDTO
) {
  return prisma.$transaction(async (tx) => {
    const ordre = data.ordre ?? 0;
    const ordreArticle = data.article.ordre ?? 0;
    assertEntierColonneInt(ordre, "ordre");
    assertEntierColonneInt(ordreArticle, "article.ordre");
    if (data.repartitions) {
      for (const r of data.repartitions) {
        assertEntierColonneInt(r.moisCycle, "moisCycle");
      }
    }

    const scenario = await tx.scenarioPrevision.findFirst({
      where: { id: scenarioId, siteId },
      select: { id: true },
    });
    if (!scenario) {
      throw new Error("Scenario introuvable");
    }

    if (data.repartitions && data.repartitions.length > 0) {
      const repartitionsInput: RepartitionMoisInput[] = data.repartitions.map((r) => ({
        moisCycle: r.moisCycle,
        pourcentage: new Decimal(r.pourcentage),
      }));
      validerSommeRepartitionMoisAliment(repartitionsInput);
    }

    const calibre = await tx.alimentPrevision.create({
      data: {
        scenarioId,
        tailleGranule: data.tailleGranule,
        sacsParTonneStandard: data.sacsParTonneStandard ?? null,
        ordre,
        siteId,
      },
    });

    await tx.alimentArticlePrevision.create({
      data: {
        alimentCalibrePrevisionId: calibre.id,
        produitId: data.article.produitId ?? null,
        libelle: data.article.libelle,
        poidsSacKg: data.article.poidsSacKg,
        prixSacFCFA: data.article.prixSacFCFA,
        sacsParTonneUnitaire: calculerSacsParTonneUnitaire(data.article.poidsSacKg).toString(),
        // ADR-053 §12.6 : 100% implicite, ecrit par le serveur, jamais demande a l'utilisateur.
        partApprovisionnementPct: 100,
        ordre: ordreArticle,
        siteId,
      },
    });

    if (data.repartitions && data.repartitions.length > 0) {
      await tx.repartitionMoisAliment.createMany({
        data: data.repartitions.map((r) => ({
          alimentPrevisionId: calibre.id,
          moisCycle: r.moisCycle,
          pourcentage: r.pourcentage,
          siteId,
        })),
      });
    }

    return tx.alimentPrevision.findUniqueOrThrow({
      where: { id: calibre.id },
      include: ALIMENT_INCLUDE,
    });
  });
}

/** Met a jour les champs du CALIBRE (jamais ceux d'un article — voir updateAlimentArticlePrevision). */
export async function updateAlimentPrevision(id: string, siteId: string, data: UpdateAlimentPrevisionDTO) {
  if (data.ordre !== undefined) {
    assertEntierColonneInt(data.ordre, "ordre");
  }

  const { count } = await prisma.alimentPrevision.updateMany({
    where: { id, siteId },
    data: {
      ...(data.sacsParTonneStandard !== undefined && { sacsParTonneStandard: data.sacsParTonneStandard }),
      ...(data.ordre !== undefined && { ordre: data.ordre }),
    },
  });
  if (count === 0) {
    throw new Error("Aliment previsionnel introuvable");
  }

  return prisma.alimentPrevision.findUniqueOrThrow({
    where: { id },
    include: ALIMENT_INCLUDE,
  });
}

/**
 * addAlimentArticlePrevision — ajoute un second (ou N-ieme) article a un
 * calibre existant (ADR-053 §12.6 : action secondaire explicite). Cree le
 * nouvel article ET remplace en bloc les parts d'approvisionnement de TOUS
 * les articles du calibre (celui deja existant inclus), dans une seule
 * transaction, apres validation bloquante "somme = 100%" (ADR-053 §12.2
 * arbitrage 3, meme patron que `replaceRepartitionsMoisAliment`).
 */
export async function addAlimentArticlePrevision(
  alimentPrevisionId: string,
  siteId: string,
  data: AddAlimentArticlePrevisionDTO
) {
  return prisma.$transaction(async (tx) => {
    const ordre = data.nouvelArticle.ordre ?? 0;
    assertEntierColonneInt(ordre, "nouvelArticle.ordre");

    const calibre = await tx.alimentPrevision.findFirst({
      where: { id: alimentPrevisionId, siteId },
      select: { id: true },
    });
    if (!calibre) {
      throw new Error("Aliment previsionnel introuvable");
    }

    const articlesExistants = await tx.alimentArticlePrevision.findMany({
      where: { alimentCalibrePrevisionId: alimentPrevisionId, siteId },
      select: { id: true },
    });
    const idsExistants = new Set(articlesExistants.map((a) => a.id));

    // Validation de coherence : chaque `articleId` de la repartition doit
    // referencer un article existant de CE calibre, et exactement un
    // element (sans articleId) doit designer le nouvel article.
    const sansArticleId = data.repartition.filter((r) => r.articleId === undefined);
    if (sansArticleId.length !== 1) {
      // ValidationError (typee, cf. src/lib/errors.ts) plutot qu'une Error nue :
      // ce cas est une malformation du payload client (ex: "repartition" sans
      // aucun element sans articleId, ou avec plusieurs) et doit produire un
      // 4xx, jamais un 500 — handleApiError mappe ValidationError -> 400 sans
      // dependre d'un pattern de sous-chaine dans PREVISIONS_STATUS_MAP (bug
      // signale par le @tester, story PR2q.4, cf. ADR-053 §12).
      throw new ValidationError(
        `La repartition doit contenir exactement un element sans articleId (le nouvel article) — obtenu : ${sansArticleId.length}.`
      );
    }
    for (const r of data.repartition) {
      if (r.articleId !== undefined && !idsExistants.has(r.articleId)) {
        throw new Error(`Article introuvable pour ce calibre : ${r.articleId}.`);
      }
    }

    validerSommeApprovisionnementArticles(
      data.repartition.map((r) => new Decimal(r.partApprovisionnementPct))
    );

    const nouvelArticle = await tx.alimentArticlePrevision.create({
      data: {
        alimentCalibrePrevisionId: alimentPrevisionId,
        produitId: data.nouvelArticle.produitId ?? null,
        libelle: data.nouvelArticle.libelle,
        poidsSacKg: data.nouvelArticle.poidsSacKg,
        prixSacFCFA: data.nouvelArticle.prixSacFCFA,
        sacsParTonneUnitaire: calculerSacsParTonneUnitaire(data.nouvelArticle.poidsSacKg).toString(),
        partApprovisionnementPct: sansArticleId[0].partApprovisionnementPct,
        ordre,
        siteId,
      },
    });

    for (const r of data.repartition) {
      if (r.articleId === undefined) continue; // le nouvel article, deja cree avec sa part
      await tx.alimentArticlePrevision.update({
        where: { id: r.articleId },
        data: { partApprovisionnementPct: r.partApprovisionnementPct },
      });
    }

    return tx.alimentPrevision.findUniqueOrThrow({
      where: { id: alimentPrevisionId },
      include: ALIMENT_INCLUDE,
    });
  });
}

/** Met a jour un article existant (marque, poids de sac, prix) — jamais sa part d'approvisionnement (voir addAlimentArticlePrevision). */
export async function updateAlimentArticlePrevision(
  id: string,
  siteId: string,
  data: UpdateAlimentArticlePrevisionDTO
) {
  if (data.ordre !== undefined) {
    assertEntierColonneInt(data.ordre, "ordre");
  }

  const article = await prisma.alimentArticlePrevision.findFirst({ where: { id, siteId } });
  if (!article) {
    throw new Error("Article previsionnel introuvable");
  }

  const poidsSacKg = data.poidsSacKg ?? Number(article.poidsSacKg);

  await prisma.alimentArticlePrevision.update({
    where: { id },
    data: {
      ...(data.libelle !== undefined && { libelle: data.libelle }),
      ...(data.poidsSacKg !== undefined && {
        poidsSacKg: data.poidsSacKg,
        sacsParTonneUnitaire: calculerSacsParTonneUnitaire(poidsSacKg).toString(),
      }),
      ...(data.prixSacFCFA !== undefined && { prixSacFCFA: data.prixSacFCFA }),
      ...(data.produitId !== undefined && { produitId: data.produitId }),
      ...(data.ordre !== undefined && { ordre: data.ordre }),
    },
  });

  return prisma.alimentPrevision.findUniqueOrThrow({
    where: { id: article.alimentCalibrePrevisionId },
    include: ALIMENT_INCLUDE,
  });
}

/**
 * Remplace en bloc les RepartitionMoisAliment d'un AlimentPrevision (R4 :
 * validation "somme = 100%" ET ecriture dans la MEME transaction, ADR-053
 * section 3.5 explicite). Patron de remplacement en bloc `deleteMany` +
 * `createMany`, identique a `besoins.ts` (`ligneBesoin`).
 */
export async function replaceRepartitionsMoisAliment(
  alimentPrevisionId: string,
  siteId: string,
  repartitions: RepartitionMoisAlimentInputDTO[]
) {
  return prisma.$transaction(async (tx) => {
    for (const r of repartitions) {
      assertEntierColonneInt(r.moisCycle, "moisCycle");
    }

    const aliment = await tx.alimentPrevision.findFirst({
      where: { id: alimentPrevisionId, siteId },
      select: { id: true },
    });
    if (!aliment) {
      throw new Error("Aliment previsionnel introuvable");
    }

    const repartitionsInput: RepartitionMoisInput[] = repartitions.map((r) => ({
      moisCycle: r.moisCycle,
      pourcentage: new Decimal(r.pourcentage),
    }));
    validerSommeRepartitionMoisAliment(repartitionsInput);

    await tx.repartitionMoisAliment.deleteMany({ where: { alimentPrevisionId } });

    await tx.repartitionMoisAliment.createMany({
      data: repartitions.map((r) => ({
        alimentPrevisionId,
        moisCycle: r.moisCycle,
        pourcentage: r.pourcentage,
        siteId,
      })),
    });

    return tx.repartitionMoisAliment.findMany({
      where: { alimentPrevisionId },
      orderBy: { moisCycle: "asc" },
    });
  });
}

/**
 * Supprime un AlimentPrevision (calibre). Le cascade DB (`onDelete: Cascade`
 * sur `RepartitionMoisAliment` ET sur `AlimentArticlePrevision`, ADR-053
 * §12.3) est natif — pas de suppression manuelle enfant-par-enfant ici.
 *
 * NB : `AlimentParVaguePrevue.alimentPrevisionId` porte `onDelete: Restrict`
 * (ADR-053 section 3.6) — la suppression echoue si des lignes de besoin par
 * vague existent deja pour cet aliment, comportement delegue a la contrainte
 * DB (R4 : pas de verification prealable qui dupliquerait ce que Prisma/
 * Postgres fait deja).
 */
export async function deleteAlimentPrevision(id: string, siteId: string): Promise<void> {
  const { count } = await prisma.alimentPrevision.deleteMany({
    where: { id, siteId },
  });
  if (count === 0) {
    throw new Error("Aliment previsionnel introuvable");
  }
}

// Compat retro : nom historique conserve comme alias (routes/tests deja
// livres appellent `createAlimentPrevision`) — meme comportement que
// `createAlimentPrevisionAvecArticle`.
export const createAlimentPrevision = createAlimentPrevisionAvecArticle;

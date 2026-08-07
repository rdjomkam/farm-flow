/**
 * src/lib/queries/previsions-aliments.ts
 *
 * Queries Prisma — AlimentPrevision (le CALIBRE, portant desormais
 * directement les champs article), RepartitionMoisAliment (Sprint PR2,
 * story PR2.1). Le modele intermediaire `AlimentArticlePrevision` a ete
 * supprime (fusion article -> calibre) : chaque calibre correspond a
 * exactement un article/produit, plus de sous-liste `articles[]` ni de
 * `partApprovisionnementPct`.
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture.
 * R4 : `replaceRepartitionsMoisAliment` valide "somme = 100%" (moteur,
 *      `validerSommeRepartitionMoisAliment`) ET ecrit (deleteMany + createMany)
 *      dans la MEME transaction.
 * Piege Prisma 7 : `createAlimentPrevision` cree l'AlimentPrevision
 *      (FK brute `scenarioId`) SANS include, puis recharge via
 *      `findUniqueOrThrow` + `include` — jamais `create({ data, include })`
 *      avec une FK brute.
 */
import { prisma } from "@/lib/db";
import { TailleGranule } from "@/types";
import {
  validerSommeRepartitionMoisAliment,
  validerCouvertureMoisRepartition,
} from "@/lib/previsions/validation";
import { Decimal } from "@/lib/previsions/decimal-config";
import type { RepartitionMoisInput } from "@/lib/previsions/types";
import { BusinessRuleError } from "@/lib/errors";

/**
 * Garde applicative — colonnes Prisma `Int` de ce module (`ordre`,
 * `moisCycle`). Meme raison d'etre que la garde homonyme de
 * `previsions-vagues.ts` : Prisma tronque silencieusement (`Math.trunc`,
 * sans exception) une valeur `number` fractionnaire ecrite dans une colonne
 * `Int`, verifie empiriquement contre un vrai Postgres (story PR2.1, cf.
 * `previsions-int-fractional-integration.test.ts`) — cette garde est la
 * seule protection reelle contre une corruption silencieuse.
 *
 * @throws {BusinessRuleError} (status 400) si `valeur` n'est pas un entier — ERR-165
 */
function assertEntierColonneInt(valeur: number, nomChamp: string): void {
  if (!Number.isInteger(valeur)) {
    throw new BusinessRuleError(
      `${nomChamp} doit etre un entier (colonne Prisma Int) — valeur recue : ${valeur}.`,
      400
    );
  }
}

/**
 * DTO pour creer un calibre d'aliment previsionnel — champs article
 * (`libelle`, `poidsSacKg`, `prixSacFCFA`, `produitId`) fusionnes
 * directement sur ce DTO.
 */
export interface CreateAlimentPrevisionDTO {
  tailleGranule: TailleGranule;
  sacsParTonneStandard?: number | null;
  ordre?: number;
  libelle: string;
  poidsSacKg: number;
  prixSacFCFA: number;
  produitId?: string | null;
  /** Repartitions mensuelles initiales — optionnelles a la creation, remplacables ensuite via replaceRepartitionsMoisAliment */
  repartitions?: { moisCycle: number; pourcentage: number }[];
}

export interface UpdateAlimentPrevisionDTO {
  sacsParTonneStandard?: number | null;
  ordre?: number;
  libelle?: string;
  poidsSacKg?: number;
  prixSacFCFA?: number;
  produitId?: string | null;
}

export interface RepartitionMoisAlimentInputDTO {
  moisCycle: number;
  pourcentage: number;
}

/** Calcule sacsParTonneUnitaire (1000 / poidsSacKg) — ratio d'unite pur (ERR-138). */
function calculerSacsParTonneUnitaire(poidsSacKg: number): Decimal {
  const p = new Decimal(poidsSacKg);
  return p.lte(0) ? new Decimal(0) : new Decimal(1000).dividedBy(p);
}

const ALIMENT_INCLUDE = {
  repartitions: { orderBy: { moisCycle: "asc" as const } },
};

/**
 * Liste les AlimentPrevision (calibres) d'un scenario, avec leurs
 * repartitions incluses (evite le N+1).
 */
export async function getAlimentsPrevisionParScenario(scenarioId: string, siteId: string) {
  return prisma.alimentPrevision.findMany({
    where: { scenarioId, siteId },
    include: ALIMENT_INCLUDE,
    orderBy: { ordre: "asc" },
  });
}

/** Recupere un AlimentPrevision (calibre) par id avec ses repartitions. */
export async function getAlimentPrevisionById(id: string, siteId: string) {
  return prisma.alimentPrevision.findFirst({
    where: { id, siteId },
    include: ALIMENT_INCLUDE,
  });
}

/**
 * Cree un calibre (AlimentPrevision, champs article inclus) + ses
 * RepartitionMoisAliment optionnelles, DANS UNE SEULE TRANSACTION.
 */
export async function createAlimentPrevision(
  scenarioId: string,
  siteId: string,
  data: CreateAlimentPrevisionDTO
) {
  return prisma.$transaction(async (tx) => {
    const ordre = data.ordre ?? 0;
    assertEntierColonneInt(ordre, "ordre");
    if (data.repartitions) {
      for (const r of data.repartitions) {
        assertEntierColonneInt(r.moisCycle, "moisCycle");
      }
    }

    const scenario = await tx.scenarioPrevision.findFirst({
      where: { id: scenarioId, siteId },
      select: { id: true, dureeCycleMois: true },
    });
    if (!scenario) {
      throw new Error("Scenario introuvable");
    }

    // ERR-162 : `repartitions` reste optionnelle a la creation (docstring
    // CreateAlimentPrevisionDTO — un calibre peut etre cree sans planning
    // mensuel, rempli ensuite via `replaceRepartitionsMoisAliment`), donc un
    // champ ABSENT (`undefined`) continue de sauter la validation. Mais des
    // qu'un tableau est FOURNI (meme vide, meme partiel), il doit etre
    // complet et valide — jamais seulement "somme = 100%" (ce qui laissait
    // passer un mois de cycle omis, cf. ERR-162), desormais aussi "couvre
    // 1..dureeCycleMois" (validerCouvertureMoisRepartition).
    if (data.repartitions !== undefined) {
      const repartitionsInput: RepartitionMoisInput[] = data.repartitions.map((r) => ({
        moisCycle: r.moisCycle,
        pourcentage: new Decimal(r.pourcentage),
      }));
      validerSommeRepartitionMoisAliment(repartitionsInput);
      validerCouvertureMoisRepartition(repartitionsInput, scenario.dureeCycleMois);
    }

    const calibre = await tx.alimentPrevision.create({
      data: {
        scenarioId,
        tailleGranule: data.tailleGranule,
        sacsParTonneStandard: data.sacsParTonneStandard ?? null,
        ordre,
        produitId: data.produitId ?? null,
        libelle: data.libelle,
        poidsSacKg: data.poidsSacKg,
        prixSacFCFA: data.prixSacFCFA,
        sacsParTonneUnitaire: calculerSacsParTonneUnitaire(data.poidsSacKg).toString(),
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

/** Met a jour les champs d'un calibre (coefficient de besoin et/ou champs article). */
export async function updateAlimentPrevision(id: string, siteId: string, data: UpdateAlimentPrevisionDTO) {
  if (data.ordre !== undefined) {
    assertEntierColonneInt(data.ordre, "ordre");
  }

  const existant = await prisma.alimentPrevision.findFirst({ where: { id, siteId } });
  if (!existant) {
    throw new Error("Aliment previsionnel introuvable");
  }

  const poidsSacKg = data.poidsSacKg ?? Number(existant.poidsSacKg);

  const { count } = await prisma.alimentPrevision.updateMany({
    where: { id, siteId },
    data: {
      ...(data.sacsParTonneStandard !== undefined && { sacsParTonneStandard: data.sacsParTonneStandard }),
      ...(data.ordre !== undefined && { ordre: data.ordre }),
      ...(data.libelle !== undefined && { libelle: data.libelle }),
      ...(data.poidsSacKg !== undefined && {
        poidsSacKg: data.poidsSacKg,
        sacsParTonneUnitaire: calculerSacsParTonneUnitaire(poidsSacKg).toString(),
      }),
      ...(data.prixSacFCFA !== undefined && { prixSacFCFA: data.prixSacFCFA }),
      ...(data.produitId !== undefined && { produitId: data.produitId }),
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
 * Remplace en bloc les RepartitionMoisAliment d'un AlimentPrevision (R4 :
 * validation "somme = 100%" ET ecriture dans la MEME transaction).
 * Patron de remplacement en bloc `deleteMany` + `createMany`, identique a
 * `besoins.ts` (`ligneBesoin`).
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
      select: { id: true, scenarioId: true },
    });
    if (!aliment) {
      throw new Error("Aliment previsionnel introuvable");
    }
    // Requete separee plutot qu'un select imbrique (`scenario: { select: {...} }`)
    // — meme style que `createAlimentPrevision` ci-dessus, qui charge deja le
    // scenario dans un appel distinct pour la meme raison (garder chaque
    // requete a un seul niveau de relation).
    const scenario = await tx.scenarioPrevision.findFirst({
      where: { id: aliment.scenarioId },
      select: { dureeCycleMois: true },
    });
    if (!scenario) {
      throw new Error("Scenario introuvable");
    }

    const repartitionsInput: RepartitionMoisInput[] = repartitions.map((r) => ({
      moisCycle: r.moisCycle,
      pourcentage: new Decimal(r.pourcentage),
    }));
    validerSommeRepartitionMoisAliment(repartitionsInput);
    // ERR-162 : remplacer les repartitions est une action explicite et
    // complete (contrairement a la creation, `repartitions` n'est pas
    // optionnelle ici, cf. signature) — toujours verifiee, y compris pour un
    // tableau vide (deja rejete par la validation de somme ci-dessus, mais la
    // couverture donne un message qui nomme les mois manquants).
    validerCouvertureMoisRepartition(repartitionsInput, scenario.dureeCycleMois);

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
 * sur `RepartitionMoisAliment`) est natif — pas de suppression manuelle
 * enfant-par-enfant ici.
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

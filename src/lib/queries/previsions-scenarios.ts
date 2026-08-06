/**
 * src/lib/queries/previsions-scenarios.ts
 *
 * Queries Prisma — ScenarioPrevision, ParametresPrevision, PalierRemise
 * (Sprint PR2, story PR2.1). Reference ADR-053, section 3.2-3.4.
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture.
 * R4 : `replacePaliersRemise` est un remplacement en bloc dans une seule
 *      transaction (deleteMany + createMany), jamais check-then-write.
 * Piege Prisma 7 : `create()`/`update()` + `include` echouent avec des FK
 *      brutes ("Argument 'x' is missing") — pattern applique partout ici :
 *      `create({ data })` (sans include) puis `findUniqueOrThrow({ where, include })`.
 */
import { prisma } from "@/lib/db";
import {
  StatutScenarioPrevision,
  CategorieProduit,
  TailleGranule,
  evaluerEligibiliteProduitAlimentairePrevision,
} from "@/types";
import { Decimal } from "@/lib/previsions/decimal-config";
import { validerPaliersRemiseCroissants } from "@/lib/previsions/validation";
import type { PalierRemiseInput } from "@/lib/previsions/types";
import { BusinessRuleError } from "@/lib/errors";

/**
 * Garde applicative — colonnes Prisma `Int` de ce module (`dureeCycleMois`,
 * `effectifAlevinsParVague`, `nombreBacsSimultanesCible`,
 * `capaciteTransport*`, `ordre`). Meme raison d'etre que la garde homonyme
 * de `previsions-vagues.ts` : Prisma tronque silencieusement (`Math.trunc`,
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

// ---------------------------------------------------------------------------
// Types d'entree (locaux a cette story — pas de DTO partage dans @/types)
// ---------------------------------------------------------------------------

export interface CreateScenarioPrevisionDTO {
  code: string;
  nom: string;
  description?: string | null;
  dureeCycleMois?: number;
  dateDebutPlan: string;
  userId: string;
  /** ParametresPrevision — 1-1 obligatoire des la creation (ADR-053 section 3.3) */
  parametres: {
    effectifAlevinsParVague: number;
    margeSecuriteAlevinsPct: number;
    poidsMoyenInitialG: number;
    poidsObjectifG: number;
    prixAlevinUnitaireFCFA: number;
    prixVenteKgFCFA: number;
    nombreBacsSimultanesCible: number;
    frequenceStockageMois: number;
    capaciteTransportAlimentsSacs?: number;
    coutTransportAlimentsFCFA?: number;
    capaciteTransportPoissonsKg?: number;
    coutTransportPoissonsFCFA?: number;
    capaciteTransportAlevinsNb?: number;
    coutTransportAlevinsFCFA?: number;
    /** Story PR2q.2 — optionnel, retombe sur @default(30) si absent. */
    tauxEpargnePct?: number;
    /** ADR-053 §14 / ERR-170 — defaut applique a la creation des VaguePrevue */
    alevinsAchetesParDefaut?: boolean;
    /** §4.1 des exigences — LIBRE, peut etre negative. Optionnel, retombe sur @default(0). */
    tresorerieInitialeFCFA?: number;
  };
  /**
   * ADR-053 §18 — selection explicite des Produit ALIMENT a copier vers le
   * scenario. ABSENT (`undefined`) : comportement historique STRICTEMENT
   * inchange (copie de tous les Produit ALIMENT actifs du site, garde 422
   * tout-ou-rien inchange sur `tailleGranule`). Tableau (y compris `[]`) :
   * exactement cette liste, chaque id valide (appartenance au site,
   * categorie ALIMENT, actif, ET eligible au sens de
   * `evaluerEligibiliteProduitAlimentairePrevision`) AVANT toute ecriture
   * (`validerProduitIdsEligibles`, avant `tx.$transaction`).
   */
  produitIds?: string[];
}

export interface UpdateParametresPrevisionDTO {
  effectifAlevinsParVague?: number;
  margeSecuriteAlevinsPct?: number;
  poidsMoyenInitialG?: number;
  poidsObjectifG?: number;
  prixAlevinUnitaireFCFA?: number;
  prixVenteKgFCFA?: number;
  nombreBacsSimultanesCible?: number;
  frequenceStockageMois?: number;
  capaciteTransportAlimentsSacs?: number;
  coutTransportAlimentsFCFA?: number;
  capaciteTransportPoissonsKg?: number;
  coutTransportPoissonsFCFA?: number;
  capaciteTransportAlevinsNb?: number;
  coutTransportAlevinsFCFA?: number;
  tauxEpargnePct?: number;
  alevinsAchetesParDefaut?: boolean;
  tresorerieInitialeFCFA?: number;
}

export interface PalierRemiseInputDTO {
  seuilTonnes: number;
  pourcentageRemise: number;
  ordre: number;
}

// ---------------------------------------------------------------------------
// Produits alimentaires eligibles (ADR-053 §18 — GET
// /api/previsions/produits-alimentaires-eligibles)
// ---------------------------------------------------------------------------

/**
 * Liste TOUS les `Produit` de categorie ALIMENT actifs du site, chacun avec
 * `eligible`/`raisonsInvalidite` calcules via l'UNIQUE definition
 * `evaluerEligibiliteProduitAlimentairePrevision` (jamais recalcule ici a la
 * main). AUCUN filtrage sur l'eligibilite : un produit invalide reste dans
 * la reponse, marque comme tel — ERR-173/ERR-185, une liste filtree ne peut
 * pas servir de base a une conclusion sur ce qu'elle cache. Meme `where` et
 * meme `orderBy: { nom: "asc" }` que `copierAlimentsPrevisionDepuisProduits`
 * (ADR-053 §18.1), pour la coherence visuelle avec le regroupement par
 * calibre.
 */
export async function getProduitsAlimentairesEligibles(siteId: string) {
  const produits = await prisma.produit.findMany({
    where: { siteId, categorie: CategorieProduit.ALIMENT, isActive: true },
    orderBy: { nom: "asc" },
    select: {
      id: true,
      nom: true,
      tailleGranule: true,
      contenance: true,
      prixUnitaire: true,
    },
  });

  return produits.map((produit) => {
    // Cast : l'enum genere par Prisma (`@/generated/prisma/enums`) et l'enum
    // miroir de `@/types/models` partagent les memes valeurs litterales
    // mais sont deux declarations `enum` distinctes, non compatibles
    // structurellement pour TypeScript (nominal typing) — meme pattern que
    // le cast deja utilise plus bas dans ce fichier (:312).
    const tailleGranule = produit.tailleGranule as TailleGranule | null;
    const evaluation = evaluerEligibiliteProduitAlimentairePrevision({
      tailleGranule,
      contenance: produit.contenance,
    });
    return {
      id: produit.id,
      nom: produit.nom,
      tailleGranule,
      contenance: produit.contenance,
      prixUnitaire: produit.prixUnitaire,
      eligible: evaluation.eligible,
      raisonsInvalidite: evaluation.raisonsInvalidite,
    };
  });
}

// ---------------------------------------------------------------------------
// ScenarioPrevision
// ---------------------------------------------------------------------------

/** Liste les scenarios d'un site avec filtre optionnel sur le statut, et pagination. */
export async function getScenarios(
  siteId: string,
  filters?: { statut?: StatutScenarioPrevision },
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.statut) where.statut = filters.statut;

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.scenarioPrevision.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.scenarioPrevision.count({ where }),
  ]);

  return { data, total };
}

/** Recupere un scenario avec ses parametres et paliers de remise (include simple, pas de N+1). */
export async function getScenarioById(id: string, siteId: string) {
  return prisma.scenarioPrevision.findFirst({
    where: { id, siteId },
    include: {
      parametres: true,
      paliersRemise: { orderBy: { ordre: "asc" } },
      _count: { select: { aliments: true } },
    },
  });
}

/**
 * Cree un scenario complet en transaction : ScenarioPrevision + ParametresPrevision
 * (1-1 obligatoire, ADR-053 section 3.3) + copie des AlimentPrevision depuis les
 * Produit de categorie ALIMENT actifs du site (ADR-053 decision 1 : copie, puis
 * decouplage total — jamais relu depuis Produit au moment du calcul).
 */
export async function createScenario(siteId: string, data: CreateScenarioPrevisionDTO) {
  /*
   * ADR-053 §18.3 point 2 — validation des `produitIds` (si fournis) AVANT
   * toute ouverture de transaction d'ecriture : un id fautif est rejete par
   * une simple lecture, sans jamais amorcer `ScenarioPrevision`/
   * `ParametresPrevision`. Seul un produit EFFECTIVEMENT CHOISI (present
   * dans `produitIds`) peut faire echouer la creation — le tout-ou-rien
   * historique sur les Produit ALIMENT actifs du site (garde inchangee plus
   * bas, chemin `produitIds` absent) ne s'applique jamais ici.
   */
  if (data.produitIds !== undefined) {
    await validerProduitIdsEligibles(siteId, data.produitIds);
  }

  return prisma.$transaction(async (tx) => {
    if (data.dureeCycleMois !== undefined) {
      assertEntierColonneInt(data.dureeCycleMois, "dureeCycleMois");
    }
    assertEntierColonneInt(data.parametres.effectifAlevinsParVague, "effectifAlevinsParVague");
    assertEntierColonneInt(data.parametres.nombreBacsSimultanesCible, "nombreBacsSimultanesCible");
    if (data.parametres.capaciteTransportAlimentsSacs !== undefined) {
      assertEntierColonneInt(
        data.parametres.capaciteTransportAlimentsSacs,
        "capaciteTransportAlimentsSacs"
      );
    }
    if (data.parametres.capaciteTransportPoissonsKg !== undefined) {
      assertEntierColonneInt(
        data.parametres.capaciteTransportPoissonsKg,
        "capaciteTransportPoissonsKg"
      );
    }
    if (data.parametres.capaciteTransportAlevinsNb !== undefined) {
      assertEntierColonneInt(
        data.parametres.capaciteTransportAlevinsNb,
        "capaciteTransportAlevinsNb"
      );
    }

    const existing = await tx.scenarioPrevision.findUnique({
      where: { siteId_code: { siteId, code: data.code } },
    });
    if (existing) {
      throw new Error(`Le code "${data.code}" est deja utilise pour ce site`);
    }

    const scenario = await tx.scenarioPrevision.create({
      data: {
        code: data.code,
        nom: data.nom,
        description: data.description ?? null,
        dureeCycleMois: data.dureeCycleMois ?? 3,
        dateDebutPlan: new Date(data.dateDebutPlan),
        statut: StatutScenarioPrevision.BROUILLON,
        userId: data.userId,
        siteId,
      },
    });

    await tx.parametresPrevision.create({
      data: {
        scenarioId: scenario.id,
        effectifAlevinsParVague: data.parametres.effectifAlevinsParVague,
        margeSecuriteAlevinsPct: data.parametres.margeSecuriteAlevinsPct,
        poidsMoyenInitialG: data.parametres.poidsMoyenInitialG,
        poidsObjectifG: data.parametres.poidsObjectifG,
        prixAlevinUnitaireFCFA: data.parametres.prixAlevinUnitaireFCFA,
        prixVenteKgFCFA: data.parametres.prixVenteKgFCFA,
        nombreBacsSimultanesCible: data.parametres.nombreBacsSimultanesCible,
        frequenceStockageMois: data.parametres.frequenceStockageMois,
        ...(data.parametres.capaciteTransportAlimentsSacs !== undefined && {
          capaciteTransportAlimentsSacs: data.parametres.capaciteTransportAlimentsSacs,
        }),
        ...(data.parametres.coutTransportAlimentsFCFA !== undefined && {
          coutTransportAlimentsFCFA: data.parametres.coutTransportAlimentsFCFA,
        }),
        ...(data.parametres.capaciteTransportPoissonsKg !== undefined && {
          capaciteTransportPoissonsKg: data.parametres.capaciteTransportPoissonsKg,
        }),
        ...(data.parametres.coutTransportPoissonsFCFA !== undefined && {
          coutTransportPoissonsFCFA: data.parametres.coutTransportPoissonsFCFA,
        }),
        ...(data.parametres.capaciteTransportAlevinsNb !== undefined && {
          capaciteTransportAlevinsNb: data.parametres.capaciteTransportAlevinsNb,
        }),
        ...(data.parametres.coutTransportAlevinsFCFA !== undefined && {
          coutTransportAlevinsFCFA: data.parametres.coutTransportAlevinsFCFA,
        }),
        ...(data.parametres.tauxEpargnePct !== undefined && {
          tauxEpargnePct: data.parametres.tauxEpargnePct,
        }),
        ...(data.parametres.alevinsAchetesParDefaut !== undefined && {
          alevinsAchetesParDefaut: data.parametres.alevinsAchetesParDefaut,
        }),
        ...(data.parametres.tresorerieInitialeFCFA !== undefined && {
          tresorerieInitialeFCFA: data.parametres.tresorerieInitialeFCFA,
        }),
      },
    });

    await copierAlimentsPrevisionDepuisProduits(tx, scenario.id, siteId, data.produitIds);

    const scenarioCree = await tx.scenarioPrevision.findUniqueOrThrow({
      where: { id: scenario.id },
      include: {
        parametres: true,
        paliersRemise: { orderBy: { ordre: "asc" } },
        _count: { select: { aliments: true } },
      },
    });

    /*
     * ADR-053 §18.2(b) — signal explicite, TOUJOURS present sur une reponse
     * de creation reussie (jamais `undefined`) : `0` est une valeur
     * legitime distincte d'un champ non charge (ERR-173/ERR-185). Alimente
     * par `_count.aliments`, jamais recompte a la main.
     */
    const { _count, ...scenarioSansCount } = scenarioCree;
    return {
      ...scenarioSansCount,
      nombreCalibresAlimentsCrees: _count.aliments,
    };
  });
}

/**
 * Valide un tableau `produitIds` (ADR-053 §18.3 point 2) contre deux
 * familles de rejet DISTINCTES, jamais melangees dans le meme message :
 *   1. APPARTENANCE — id inconnu, hors site, hors categorie ALIMENT, ou
 *      inactif : rejete par la requete `findMany` elle-meme (absent du
 *      resultat = id invalide), jamais rapporte comme "raisonInvalidite".
 *   2. QUALITE — produit trouve mais `tailleGranule`/`contenance` non
 *      exploitables au sens de `evaluerEligibiliteProduitAlimentairePrevision`
 *      (l'UNIQUE definition de la regle, partagee avec la route GET
 *      `/api/previsions/produits-alimentaires-eligibles`).
 * Un tableau vide (`[]`) est une selection vide legitime (arbitrage c,
 * ADR-053 §18) — ne declenche aucune lecture ni rejet.
 *
 * @throws {BusinessRuleError} 422 nommant le ou les produits fautifs.
 */
async function validerProduitIdsEligibles(siteId: string, produitIds: string[]): Promise<void> {
  if (produitIds.length === 0) return;

  const produitsTrouves = await prisma.produit.findMany({
    where: {
      id: { in: produitIds },
      siteId,
      categorie: CategorieProduit.ALIMENT,
      isActive: true,
    },
    select: { id: true, nom: true, tailleGranule: true, contenance: true },
  });

  const trouveParId = new Map(produitsTrouves.map((p) => [p.id, p]));

  const idsIntrouvables = produitIds.filter((id) => !trouveParId.has(id));
  if (idsIntrouvables.length > 0) {
    throw new BusinessRuleError(
      `produitIds invalide(s) — introuvable(s), hors site, hors categorie ALIMENT, ou inactif(s) : ${idsIntrouvables.join(", ")}.`,
      422
    );
  }

  const produitsNonEligibles = produitsTrouves
    .map((p) => ({
      produit: p,
      // Cast : voir le commentaire equivalent de `getProduitsAlimentairesEligibles`.
      evaluation: evaluerEligibiliteProduitAlimentairePrevision({
        tailleGranule: p.tailleGranule as TailleGranule | null,
        contenance: p.contenance,
      }),
    }))
    .filter((entree) => !entree.evaluation.eligible);

  if (produitsNonEligibles.length > 0) {
    const detail = produitsNonEligibles
      .map(
        ({ produit, evaluation }) =>
          `${produit.nom} (${produit.id}) : ${evaluation.raisonsInvalidite.join(", ")}`
      )
      .join(" ; ");
    throw new BusinessRuleError(
      `Produit(s) alimentaire(s) non eligible(s) pour ce scenario : ${detail}.`,
      422
    );
  }
}

/**
 * Copie les Produit de categorie ALIMENT actifs du site en calibres
 * (AlimentPrevision) + articles (AlimentArticlePrevision) du scenario
 * nouvellement cree (ADR-053 decision 1 : "pre-remplies par copie depuis
 * Produit a la creation" ; restructuration a deux niveaux, amendement §12,
 * Sprint PR2-quater).
 *
 * `produitIds` (ADR-053 §18) : `undefined` -> comportement historique
 * STRICTEMENT inchange (tous les Produit ALIMENT actifs du site, garde
 * 422 tout-ou-rien inchange sur `tailleGranule`). Tableau (deja valide par
 * `validerProduitIdsEligibles` avant l'ouverture de la transaction) -> le
 * groupe est restreint a ce sous-ensemble APRES le tri `orderBy: nom asc`
 * (`Array.filter` preserve l'ordre relatif — ne jamais reconstruire l'ordre
 * depuis `produitIds`, qui n'a aucune garantie d'ordre cote client).
 *
 * REGROUPEMENT PAR `tailleGranule` (ADR-053 §12.4) : `tailleGranule` etant
 * devenue l'IDENTITE du calibre (`@@unique([scenarioId, tailleGranule])`),
 * plusieurs `Produit` partageant la meme granulometrie deviennent
 * naturellement plusieurs ARTICLES d'UN SEUL calibre — c'est exactement le
 * cas multi-marque que l'amendement §12 rend possible (§12.1, §12.5), pas
 * une degenerescence a eviter.
 *
 * `Produit.tailleGranule` NULLABLE (ADR-053 §12.2 arbitrage 5) : un produit
 * ALIMENT sans granulometrie ne peut PAS etre copie sans DEVINER une valeur
 * (proscrit partout ailleurs dans cet ADR) — REJET NOMME, explicite, jamais
 * une valeur inventee ni un abandon silencieux : la creation du scenario
 * echoue avec un message qui nomme le(s) produit(s) fautif(s), a l'identique
 * de la discipline deja appliquee par la migration (§12.2 arbitrage 5).
 *
 * `ordre` d'affichage : ordre alphabetique sur `nom` du Produit source, pour
 * un resultat deterministe (pas d'ordre implicite dependant de l'insertion)
 * — au niveau calibre (premier `Produit` alphabetique du groupe) ET au
 * niveau article (au sein d'un meme groupe).
 * `sacsParTonneUnitaire` : derive de `poidsSacKg` (1000 / poidsSacKg), calcule en
 * Decimal moteur pour rester coherent avec le reste du module — jamais
 * recalcule depuis Produit apres la creation (decouplage total, decision 1).
 * `sacsParTonneStandard` (coefficient de besoin en aliment par tonne de
 * POISSON produit) initialise a `null` au niveau calibre : aucune source de
 * derivation automatique n'existe dans Produit (ADR-053, amendement Sprint
 * PR2 §11) — l'utilisateur doit le saisir avant que le calcul du scenario
 * soit fiable.
 * `partApprovisionnementPct` : repartie egalement entre les articles d'un
 * meme calibre (Decimal exact, reste attribue au dernier article du groupe
 * pour garantir Sigma = 100 exactement) — valeur de depart raisonnable,
 * modifiable ensuite par l'utilisateur (ADR-053 §12.2 arbitrage 3). N=1 ->
 * 100% exactement, cas nominal inchange (§12.6).
 */
async function copierAlimentsPrevisionDepuisProduits(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  scenarioId: string,
  siteId: string,
  produitIds?: string[]
): Promise<void> {
  const produitsTries = await tx.produit.findMany({
    where: { siteId, categorie: CategorieProduit.ALIMENT, isActive: true },
    orderBy: { nom: "asc" },
  });

  const produits =
    produitIds === undefined
      ? produitsTries
      : produitsTries.filter((p) => produitIds.includes(p.id));

  if (produits.length === 0) return;

  const sansTailleGranule = produits.filter((p) => !p.tailleGranule);
  if (sansTailleGranule.length > 0) {
    throw new BusinessRuleError(
      `Impossible de copier les aliments previsionnels : produit(s) sans tailleGranule : ` +
        sansTailleGranule.map((p) => `${p.nom} (${p.id})`).join(", ") +
        `. Renseignez la granulometrie de ce(s) produit(s) avant de creer un scenario.`,
      422
    );
  }

  const groupesParTailleGranule = new Map<TailleGranule, typeof produits>();
  for (const produit of produits) {
    const taille = produit.tailleGranule as TailleGranule;
    const groupe = groupesParTailleGranule.get(taille);
    if (groupe) {
      groupe.push(produit);
    } else {
      groupesParTailleGranule.set(taille, [produit]);
    }
  }

  let ordreCalibre = 0;
  for (const [tailleGranule, groupe] of groupesParTailleGranule) {
    const calibre = await tx.alimentPrevision.create({
      data: {
        scenarioId,
        tailleGranule,
        sacsParTonneStandard: null,
        ordre: ordreCalibre,
        siteId,
      },
    });
    ordreCalibre += 1;

    const parts = repartirPourcentagesEgaux(groupe.length);

    await tx.alimentArticlePrevision.createMany({
      data: groupe.map((produit, indexArticle) => {
        const poidsSacKg = new Decimal(produit.contenance ?? 0);
        const sacsParTonneUnitaire = poidsSacKg.lte(0) ? new Decimal(0) : new Decimal(1000).dividedBy(poidsSacKg);

        return {
          alimentCalibrePrevisionId: calibre.id,
          produitId: produit.id,
          libelle: produit.nom,
          poidsSacKg: poidsSacKg.toString(),
          prixSacFCFA: produit.prixUnitaire,
          sacsParTonneUnitaire: sacsParTonneUnitaire.toString(),
          partApprovisionnementPct: parts[indexArticle].toString(),
          ordre: indexArticle,
          siteId,
        };
      }),
    });
  }
}

/**
 * repartirPourcentagesEgaux — repartition de depart EGALE entre `n`
 * articles issus de la copie automatique (§12.2 arbitrage 5 : valeur de
 * depart raisonnable, PAS la repartition d'achat reelle des sacs — celle-ci
 * reste `repartirSacsEntreArticles`, aliments.ts, methode du plus fort
 * reste, exigee par l'ADR pour la repartition DES SACS). Ici : simple
 * partage de depart des pourcentages de configuration, Sigma = 100
 * EXACTEMENT (le reste de la division va au DERNIER article, ordre croissant
 * — deterministe). N=1 -> [100] exactement (cas nominal, §12.6).
 */
function repartirPourcentagesEgaux(n: number): Decimal[] {
  if (n <= 1) return [new Decimal(100)];

  const base = new Decimal(100).dividedBy(n).toDecimalPlaces(4, Decimal.ROUND_DOWN);
  const parts = Array.from({ length: n }, () => base);
  const somme = parts.reduce((s, p) => s.plus(p), new Decimal(0));
  const reste = new Decimal(100).minus(somme);
  parts[n - 1] = parts[n - 1].plus(reste);
  return parts;
}

/** Met a jour les ParametresPrevision d'un scenario (1-1, update cible, pas de bulk replace). */
export async function updateParametresPrevision(
  scenarioId: string,
  siteId: string,
  data: UpdateParametresPrevisionDTO
) {
  if (data.effectifAlevinsParVague !== undefined) {
    assertEntierColonneInt(data.effectifAlevinsParVague, "effectifAlevinsParVague");
  }
  if (data.nombreBacsSimultanesCible !== undefined) {
    assertEntierColonneInt(data.nombreBacsSimultanesCible, "nombreBacsSimultanesCible");
  }
  if (data.capaciteTransportAlimentsSacs !== undefined) {
    assertEntierColonneInt(data.capaciteTransportAlimentsSacs, "capaciteTransportAlimentsSacs");
  }
  if (data.capaciteTransportPoissonsKg !== undefined) {
    assertEntierColonneInt(data.capaciteTransportPoissonsKg, "capaciteTransportPoissonsKg");
  }
  if (data.capaciteTransportAlevinsNb !== undefined) {
    assertEntierColonneInt(data.capaciteTransportAlevinsNb, "capaciteTransportAlevinsNb");
  }

  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    select: { id: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }

  return prisma.parametresPrevision.update({
    where: { scenarioId },
    data: {
      ...(data.effectifAlevinsParVague !== undefined && {
        effectifAlevinsParVague: data.effectifAlevinsParVague,
      }),
      ...(data.margeSecuriteAlevinsPct !== undefined && {
        margeSecuriteAlevinsPct: data.margeSecuriteAlevinsPct,
      }),
      ...(data.poidsMoyenInitialG !== undefined && { poidsMoyenInitialG: data.poidsMoyenInitialG }),
      ...(data.poidsObjectifG !== undefined && { poidsObjectifG: data.poidsObjectifG }),
      ...(data.prixAlevinUnitaireFCFA !== undefined && {
        prixAlevinUnitaireFCFA: data.prixAlevinUnitaireFCFA,
      }),
      ...(data.prixVenteKgFCFA !== undefined && { prixVenteKgFCFA: data.prixVenteKgFCFA }),
      ...(data.nombreBacsSimultanesCible !== undefined && {
        nombreBacsSimultanesCible: data.nombreBacsSimultanesCible,
      }),
      ...(data.frequenceStockageMois !== undefined && {
        frequenceStockageMois: data.frequenceStockageMois,
      }),
      ...(data.capaciteTransportAlimentsSacs !== undefined && {
        capaciteTransportAlimentsSacs: data.capaciteTransportAlimentsSacs,
      }),
      ...(data.coutTransportAlimentsFCFA !== undefined && {
        coutTransportAlimentsFCFA: data.coutTransportAlimentsFCFA,
      }),
      ...(data.capaciteTransportPoissonsKg !== undefined && {
        capaciteTransportPoissonsKg: data.capaciteTransportPoissonsKg,
      }),
      ...(data.coutTransportPoissonsFCFA !== undefined && {
        coutTransportPoissonsFCFA: data.coutTransportPoissonsFCFA,
      }),
      ...(data.capaciteTransportAlevinsNb !== undefined && {
        capaciteTransportAlevinsNb: data.capaciteTransportAlevinsNb,
      }),
      ...(data.coutTransportAlevinsFCFA !== undefined && {
        coutTransportAlevinsFCFA: data.coutTransportAlevinsFCFA,
      }),
      ...(data.tauxEpargnePct !== undefined && {
        tauxEpargnePct: data.tauxEpargnePct,
      }),
      ...(data.alevinsAchetesParDefaut !== undefined && {
        alevinsAchetesParDefaut: data.alevinsAchetesParDefaut,
      }),
      ...(data.tresorerieInitialeFCFA !== undefined && {
        tresorerieInitialeFCFA: data.tresorerieInitialeFCFA,
      }),
    },
  });
}

/**
 * Remplace en bloc les PalierRemise d'un scenario (R4 : validation + ecriture
 * dans la meme transaction, jamais une verification prealable non protegee).
 *
 * Valide que les seuils sont strictement croissants dans l'ordre fourni AVANT
 * l'ecriture (`validerPaliersRemiseCroissants`, moteur), dans la meme
 * transaction que le `deleteMany` + `createMany` — pattern de remplacement en
 * bloc deja eprouve dans `besoins.ts` (`ligneBesoin`).
 */
export async function replacePaliersRemise(
  scenarioId: string,
  siteId: string,
  paliers: PalierRemiseInputDTO[]
) {
  return prisma.$transaction(async (tx) => {
    for (const p of paliers) {
      assertEntierColonneInt(p.ordre, "ordre");
    }

    const scenario = await tx.scenarioPrevision.findFirst({
      where: { id: scenarioId, siteId },
      select: { id: true },
    });
    if (!scenario) {
      throw new Error("Scenario introuvable");
    }

    const paliersInput: PalierRemiseInput[] = paliers.map((p) => ({
      ordre: p.ordre,
      seuilTonnes: new Decimal(p.seuilTonnes),
      pourcentageRemise: new Decimal(p.pourcentageRemise),
    }));
    validerPaliersRemiseCroissants(paliersInput);

    /*
     * Deuxieme garde metier, distincte de la croissance des seuils : deux
     * paliers ne peuvent pas partager le meme `ordre`. Elle double celle du
     * schema zod de la route (`replacePaliersRemiseSchema`) parce que cette
     * fonction est appelable hors de la route ; sans elle, le `createMany`
     * ci-dessous echoue sur `@@unique([scenarioId, ordre])` en P2002, que
     * `handleApiError` traduit par "Cette valeur existe deja (scenarioId,
     * ordre)" — un message de base de donnees expose a un utilisateur
     * francais. Placee AVANT le `deleteMany` : la transaction est annulee de
     * toute facon, mais on ne demarre pas une suppression qu'on sait vouee a
     * echouer.
     *
     * ERR-165 (corrige) : le statut 400 de ce refus etait auparavant derive
     * d'une sous-chaine du message ("meme ordre d'evaluation") dans
     * `PREVISIONS_STATUS_MAP` (`src/app/api/previsions/_shared.ts`) — toute
     * accentuation legitime du message aurait casse le matching en silence
     * et fait retomber ce cas en 500. `BusinessRuleError(msg, 400)` porte
     * desormais son statut comme DONNEE (ADR-053 §15.4) : le message peut
     * etre reformule ou accentue librement, `_shared.ts` n'a plus rien a
     * tenir a jour.
     */
    const ordresVus = new Set<number>();
    for (const p of paliersInput) {
      if (ordresVus.has(p.ordre)) {
        throw new BusinessRuleError(
          `Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation (ordre=${p.ordre} apparait plusieurs fois).`,
          400
        );
      }
      ordresVus.add(p.ordre);
    }

    await tx.palierRemise.deleteMany({ where: { scenarioId } });

    if (paliers.length > 0) {
      await tx.palierRemise.createMany({
        data: paliers.map((p) => ({
          scenarioId,
          seuilTonnes: p.seuilTonnes,
          pourcentageRemise: p.pourcentageRemise,
          ordre: p.ordre,
          siteId,
        })),
      });
    }

    return tx.palierRemise.findMany({
      where: { scenarioId },
      orderBy: { ordre: "asc" },
    });
  });
}

/** Archive un scenario (statut -> ARCHIVE). Update simple, conditionne au siteId (R8). */
export async function archiverScenario(id: string, siteId: string) {
  const { count } = await prisma.scenarioPrevision.updateMany({
    where: { id, siteId },
    data: { statut: StatutScenarioPrevision.ARCHIVE },
  });
  if (count === 0) {
    throw new Error("Scenario introuvable");
  }
  return prisma.scenarioPrevision.findUniqueOrThrow({ where: { id } });
}

/** Active un scenario (statut -> ACTIF). Update simple, conditionne au siteId (R8). */
export async function activerScenario(id: string, siteId: string) {
  const { count } = await prisma.scenarioPrevision.updateMany({
    where: { id, siteId },
    data: { statut: StatutScenarioPrevision.ACTIF },
  });
  if (count === 0) {
    throw new Error("Scenario introuvable");
  }
  return prisma.scenarioPrevision.findUniqueOrThrow({ where: { id } });
}

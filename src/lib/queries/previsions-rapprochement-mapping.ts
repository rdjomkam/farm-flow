/**
 * src/lib/queries/previsions-rapprochement-mapping.ts
 *
 * Queries Prisma — `MappingRapprochement` (Sprint PR3, story PR3.3).
 * Reference ADR-053, section 3.9 et section 15.3 (amendement Sprint PR3).
 *
 * R8 : `siteId` filtre sur CHAQUE lecture/ecriture — `MappingRapprochement`
 *      est scope au site, pas au scenario (un mapping sert potentiellement
 *      plusieurs scenarios successifs du meme site, ADR-053 §3.9).
 * R4 : `creerVersionMapping` cree une NOUVELLE version en bloc dans UNE SEULE
 *      transaction — jamais un UPDATE en place du contenu (`sourceType`,
 *      `sourceCle`, `cibleType`, `cibleId`) d'une ligne deja active. Les
 *      lignes de la version precedente ne sont JAMAIS modifiees dans leur
 *      contenu : seul leur flag `actif` passe a `false`, ce qui prouve leur
 *      etat historique passe sans jamais en changer la valeur (auditabilite,
 *      ADR-053 §3.9). Ce module N'ECRIT JAMAIS dans une table du domaine
 *      reel (`Depense`, `Vente`, `MouvementStock`, ...) — ADR-053 §5.1(a)/§15.6,
 *      point de checklist obligatoire a chaque review de ce module.
 */
import { prisma } from "@/lib/db";
import { CibleRapprochement, SourceRapprochement } from "@/types";
import { BusinessRuleError } from "@/lib/errors";

export interface LigneMappingRapprochementDTO {
  sourceType: SourceRapprochement;
  /** valeur litterale de l'enum reel (ex. "ALIMENT" pour CategorieDepense) */
  sourceCle: string;
  cibleType: CibleRapprochement;
  /** nullable : NON_RAPPROCHE n'a pas de cible (ADR-053 section 5) */
  cibleId?: string | null;
}

/**
 * Lit le mapping ACTIF d'un site (la version courante, `actif = true`) —
 * lecture pure, aucune ecriture. Filtre `siteId` (R8).
 */
export async function getMappingActif(siteId: string) {
  return prisma.mappingRapprochement.findMany({
    where: { siteId, actif: true },
    orderBy: [{ sourceType: "asc" }, { sourceCle: "asc" }],
  });
}

/**
 * Lit le mapping d'un site a une version PRECISE — c'est cette fonction que
 * doit utiliser toute lecture d'un rapprochement deja clos
 * (`ClotureMois.versionMapping`, ADR-053 §15.3) : elle ne retourne JAMAIS le
 * mapping `actif` courant, uniquement la version demandee, quelle que soit
 * la version la plus recente en base au moment de l'appel — c'est
 * precisement la garantie d'immuabilite de l'historique des ecarts figes.
 */
export async function getMappingParVersion(siteId: string, version: number) {
  return prisma.mappingRapprochement.findMany({
    where: { siteId, version },
    orderBy: [{ sourceType: "asc" }, { sourceCle: "asc" }],
  });
}

/**
 * Liste les versions DISTINCTES de `MappingRapprochement` deja creees pour
 * un site, triees decroissant (la plus recente en premier) — Sprint
 * PR3-ter, story C.3 : alimente le selecteur de version de l'ecran
 * d'administration du mapping (`GET ?version=N` existait deja mais
 * `RapprochementMappingTab` ne proposait aucun moyen de choisir N — cette
 * fonction rend cette navigation possible). Lecture pure, R8 (`siteId`
 * filtre), aucune ecriture.
 */
export async function getVersionsDisponibles(siteId: string): Promise<number[]> {
  const lignes = await prisma.mappingRapprochement.findMany({
    where: { siteId },
    select: { version: true },
    distinct: ["version"],
    orderBy: { version: "desc" },
  });
  return lignes.map((l) => l.version);
}

/** Version active courante d'un site (0 si aucun mapping n'existe encore). */
async function versionActiveCourante(
  tx: Pick<typeof prisma, "mappingRapprochement">,
  siteId: string
): Promise<number> {
  const derniere = await tx.mappingRapprochement.findFirst({
    where: { siteId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return derniere?.version ?? 0;
}

/**
 * Cree une NOUVELLE VERSION du mapping d'un site, en bloc, dans une seule
 * transaction (R4) : jamais un UPDATE en place du contenu d'une ligne deja
 * active — la version precedente reste lisible integralement (auditabilite,
 * ADR-053 §3.9), seul son flag `actif` passe a `false`.
 *
 * @param lignes - le mapping COMPLET de la nouvelle version (remplacement en
 *   bloc, pas un patch incremental — coherent avec le patron deja en place
 *   pour `replacePaliersRemise`/`replaceAlimentsParVaguePrevue`).
 * @throws {BusinessRuleError} (422) si `lignes` est vide — une version sans
 *   aucune ligne ne peut jamais devenir la version active (elle rendrait
 *   TOUT rapprochement du site NON_RAPPROCHE silencieusement).
 */
export async function creerVersionMapping(siteId: string, lignes: LigneMappingRapprochementDTO[]) {
  if (lignes.length === 0) {
    throw new BusinessRuleError(
      "Le mapping doit contenir au moins une ligne — une version vide desactiverait tout le rapprochement du site.",
      422
    );
  }

  return prisma.$transaction(async (tx) => {
    const versionPrecedente = await versionActiveCourante(tx, siteId);
    const nouvelleVersion = versionPrecedente + 1;

    // Desactive les lignes actives existantes — JAMAIS un UPDATE en place de
    // leur contenu (sourceType/sourceCle/cibleType/cibleId inchanges),
    // uniquement le flag `actif` qui bascule pour rendre la nouvelle version
    // seule visible par `getMappingActif`.
    await tx.mappingRapprochement.updateMany({
      where: { siteId, actif: true },
      data: { actif: false },
    });

    await tx.mappingRapprochement.createMany({
      data: lignes.map((ligne) => ({
        siteId,
        version: nouvelleVersion,
        sourceType: ligne.sourceType,
        sourceCle: ligne.sourceCle,
        cibleType: ligne.cibleType,
        cibleId: ligne.cibleId ?? null,
        actif: true,
      })),
    });

    return tx.mappingRapprochement.findMany({
      where: { siteId, version: nouvelleVersion },
      orderBy: [{ sourceType: "asc" }, { sourceCle: "asc" }],
    });
  });
}

/** Une cle reelle presente dans les donnees du site sans mapping actif correspondant. */
export interface CategorieReelleNonMappee {
  sourceType: SourceRapprochement;
  sourceCle: string;
}

/**
 * Liste les cles reelles PRESENTES DANS LES DONNEES du site (Sprint PR3,
 * story PR3.6) qui n'ont AUCUNE entree `MappingRapprochement` active
 * correspondante — alimente le bac explicite « Non rapproche » de l'UI
 * (ADR-053 section 5 : « Toute catégorie réelle non mappée [...] est
 * affichée dans un bac explicite [...] jamais ignoree silencieusement »).
 *
 * Lecture seule, R8 (`siteId` filtre sur chaque requete). N'ECRIT JAMAIS
 * dans une table du domaine reel (ADR-053 §5.1(a)).
 *
 * PERIMETRE EXPLICITEMENT BORNE a cette story : seules les sources dont la
 * `sourceCle` correspond a une valeur d'enum litterale sans ambiguite sont
 * couvertes ici :
 * - `DEPENSE_CATEGORIE` : valeurs distinctes de `Depense.categorieDepense`
 *   REELLEMENT UTILISEES sur le site (au moins une `Depense` existe).
 * - `PRODUIT_CATEGORIE` : valeurs distinctes de `Produit.categorie` pour les
 *   produits catalogues sur le site (`Produit.siteId`).
 * - `VENTE` : la cle singleton `"VENTE"`, presente des lors que le site a
 *   au moins une `Vente` (coherent avec le seed d'integration PR3.3,
 *   `previsions-rapprochement-mapping-integration.test.ts`, qui mappe deja
 *   `SourceRapprochement.VENTE` -> `sourceCle: "VENTE"`).
 * - `MOUVEMENT_STOCK` : les valeurs de `sourceCle` sont les granulometries
 *   (`TailleGranule`, ou le litteral `"INCONNU"`) REELLEMENT rencontrees sur
 *   au moins un `MouvementStock` de type `SORTIE` portant sur un `Produit`
 *   `categorie = ALIMENT` du site — c'est EXACTEMENT la meme source et la
 *   meme convention de cle (`COALESCE(tailleGranule::text, 'INCONNU')`) que
 *   `getSortiesAlimentReellesParGranulometrie`
 *   (`src/lib/queries/previsions-rapprochement.ts`), qui alimente le "reel"
 *   du calcul d'ecarts — la semantique n'est donc plus a trancher, elle est
 *   reprise telle quelle du seul chemin de lecture MOUVEMENT_STOCK deja
 *   branche dans l'orchestration principale (`getReelAgregeSite`). C'est ce
 *   qui comblait l'angle mort signale par la review du sprint PR3
 *   (Moyenne #2, `docs/reviews/review-sprint-PR3.md`) : une granulometrie
 *   non mappee apparaissait deja dans le bac `NON_RAPPROCHE` du calcul,
 *   sans jamais apparaitre ici pour permettre de la mapper.
 *
 *   NON couvert intentionnellement : `getDepensesAlimentReellesParGranulometrie`
 *   (meme fichier, vue de detail "depense aliment par granulometrie" via
 *   `LigneDepense`) — cette fonction N'EST PAS branchee dans
 *   `getReelAgregeSite` (le chemin retenu pour le rapprochement de quantite
 *   aliment reste `MouvementStock`, pas `Depense`), donc ses cles ne
 *   participent a AUCUN calcul d'ecart aujourd'hui.
 *
 *   CORRECTIF Sprint PR3-ter, story C.1 : cette fonction emettait a tort sa
 *   nature `"DEPENSE"` sous le MEME prefixe `SourceRapprochement.MOUVEMENT_STOCK`
 *   que la nature `"QUANTITE"` lue ici (collision latente signalee par la
 *   review Moyenne #3 du sprint PR3, `docs/reviews/review-sprint-PR3.md`) —
 *   corrige : elle emet desormais `SourceRapprochement.DEPENSE_CATEGORIE`
 *   (source reelle et coherente avec sa nature DEPENSE), avec un `sourceCle`
 *   compose (`"ALIMENT:<granulometrie>"`) qui reste distinct de la cle
 *   agregee globale `"ALIMENT"` de `getDepensesReellesParCategorie`. Les deux
 *   fonctions ne collisionnent donc plus jamais, meme si une story future
 *   branche `getDepensesAlimentReellesParGranulometrie` dans `getReelAgregeSite`.
 */
export async function getCategoriesReellesNonMappees(
  siteId: string
): Promise<CategorieReelleNonMappee[]> {
  const [mappingActif, depensesCategories, produitsCategories, venteCount, granulometriesMouvementStock] =
    await Promise.all([
      prisma.mappingRapprochement.findMany({
        where: { siteId, actif: true },
        select: { sourceType: true, sourceCle: true },
      }),
      prisma.depense.groupBy({
        by: ["categorieDepense"],
        where: { siteId },
      }),
      prisma.produit.findMany({
        where: { siteId },
        select: { categorie: true },
        distinct: ["categorie"],
      }),
      prisma.vente.count({ where: { siteId } }),
      prisma.$queryRaw<{ granulometrie: string }[]>`
        SELECT DISTINCT COALESCE(p."tailleGranule"::text, 'INCONNU') AS granulometrie
        FROM "MouvementStock" ms
        JOIN "Produit" p ON p.id = ms."produitId"
        WHERE ms."siteId" = ${siteId}
          AND ms."type" = 'SORTIE'
          AND p."categorie" = 'ALIMENT'
      `,
    ]);

  const mappedKeys = new Set(mappingActif.map((m) => `${m.sourceType}::${m.sourceCle}`));

  const resultat: CategorieReelleNonMappee[] = [];

  for (const d of depensesCategories) {
    const cle = `${SourceRapprochement.DEPENSE_CATEGORIE}::${d.categorieDepense}`;
    if (!mappedKeys.has(cle)) {
      resultat.push({ sourceType: SourceRapprochement.DEPENSE_CATEGORIE, sourceCle: d.categorieDepense });
    }
  }

  for (const p of produitsCategories) {
    const cle = `${SourceRapprochement.PRODUIT_CATEGORIE}::${p.categorie}`;
    if (!mappedKeys.has(cle)) {
      resultat.push({ sourceType: SourceRapprochement.PRODUIT_CATEGORIE, sourceCle: p.categorie });
    }
  }

  if (venteCount > 0) {
    const cle = `${SourceRapprochement.VENTE}::VENTE`;
    if (!mappedKeys.has(cle)) {
      resultat.push({ sourceType: SourceRapprochement.VENTE, sourceCle: "VENTE" });
    }
  }

  for (const g of granulometriesMouvementStock) {
    const cle = `${SourceRapprochement.MOUVEMENT_STOCK}::${g.granulometrie}`;
    if (!mappedKeys.has(cle)) {
      resultat.push({ sourceType: SourceRapprochement.MOUVEMENT_STOCK, sourceCle: g.granulometrie });
    }
  }

  return resultat;
}

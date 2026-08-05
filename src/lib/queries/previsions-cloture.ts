/**
 * src/lib/queries/previsions-cloture.ts
 *
 * Queries Prisma — `ClotureMois` (Sprint PR3, story PR3.6).
 * Reference ADR-053, section 3.10 et section 15.3 (amendement Sprint PR3).
 *
 * R8 : `siteId` filtre sur CHAQUE lecture/ecriture.
 * R4 : `cloturerMois` lit la version ACTIVE du mapping du site ET cree
 *      `ClotureMois` DANS LA MEME TRANSACTION (ADR-053 §15.3 : « pas de
 *      fenetre entre "lire la version active" et "ecrire la cloture" ou un
 *      changement de mapping concurrent pourrait glisser »).
 *
 * Immuabilite : aucune fonction de ce fichier n'expose d'UPDATE ni de
 *      DELETE sur `ClotureMois` — la decloture n'est PAS implementee
 *      (decision explicite, voir JSDoc de `cloturerMois` ci-dessous) : une
 *      fois cree, un `ClotureMois` ne peut plus etre modifie que par la
 *      suppression en cascade du scenario lui-meme (`onDelete: Cascade`).
 *
 * Ce module N'ECRIT JAMAIS dans une table du domaine reel (`Depense`,
 * `Vente`, `MouvementStock`, ...) — ADR-053 §5.1(a)/§15.6.
 */
import { prisma } from "@/lib/db";
import { BusinessRuleError } from "@/lib/errors";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";

/**
 * Lit les mois clotures d'un scenario — lecture pure, aucune ecriture.
 * Filtre `siteId` (R8). Tries par `moisAbsolu` croissant.
 */
export async function getCloturesMois(scenarioId: string, siteId: string) {
  return prisma.clotureMois.findMany({
    where: { scenarioId, siteId },
    orderBy: { moisAbsolu: "asc" },
  });
}

/**
 * Cloture un mois d'un scenario (ADR-053 §3.10/§15.3) — decision humaine
 * explicite, jamais deduite implicitement d'une date passee.
 *
 * Regles metier appliquees, chacune avec son statut HTTP explicite
 * (`BusinessRuleError`, ADR-053 §15.4 — jamais un mapping par sous-chaine) :
 * - **Deux fois le meme mois : refuse (409).** `@@unique([scenarioId,
 *   moisAbsolu])` l'empecherait de toute facon au niveau base, mais la
 *   garde explicite AVANT ecriture donne un message metier clair plutot
 *   qu'une erreur Postgres brute (meme patron que
 *   `activerScenarioAvecSnapshot`, `previsions-snapshot-budget.ts`).
 * - **Mois hors de l'horizon du plan : refuse (422).** L'horizon est
 *   recalcule via `calculerProjectionScenario` (LE moteur de production,
 *   jamais une reimplementation locale — ADR-053 §15.6 point 2), jamais un
 *   champ stocke separement qui pourrait diverger de la projection reelle.
 * - **Figeage de `versionMapping` (ADR-053 §15.3) : la version ACTIVE du
 *   mapping du site au moment T, lue DANS LA MEME TRANSACTION que
 *   l'ecriture de `ClotureMois`** — jamais recalculee dynamiquement une
 *   fois le mois cloture. `versionMapping = 0` si le site n'a encore aucun
 *   mapping (aucune version active) : un `ClotureMois` reste creable meme
 *   sans mapping configure, `getMappingParVersion(siteId, 0)` retournera
 *   alors une liste vide, ce qui est la verite (aucun mapping n'existait a
 *   cet instant).
 *
 * DECLOTURE — decision explicite, tranchee ici : **NON AUTORISEE.** Aucune
 * route/fonction de decloture n'est exposee. Raison : l'ADR-053 §3.10
 * decrit la cloture comme "une decision humaine explicite" verrouillant
 * l'ecriture — rien dans l'ADR n'envisage un retour arriere, et une
 * decloture soulevrait une question non tranchee par l'ADR (si `versionMapping`
 * devait etre re-fige a la re-cloture, quelle version choisir ? la version
 * active au moment de la RE-cloture romprait la garantie d'immuabilite pour
 * tout rapprochement deja affiche/exporte entre-temps). Si un besoin de
 * decloture apparait, il doit etre tranche par un amendement ADR explicite
 * (meme discipline que la reactivation de scenario, ADR-053 §15.2), pas
 * deduit implicitement de ce code.
 *
 * @throws {BusinessRuleError} (404) si le scenario est introuvable pour ce site (R8) — propage via `chargerScenarioPourMoteur`
 * @throws {BusinessRuleError} (422) si `moisAbsolu` est hors de l'horizon du plan
 * @throws {BusinessRuleError} (409) si ce mois est deja cloture pour ce scenario
 */
export async function cloturerMois(
  scenarioId: string,
  siteId: string,
  moisAbsolu: number,
  clotureeParId: string
) {
  const scenario = await chargerScenarioPourMoteur(scenarioId, siteId);
  const { horizonMois } = calculerProjectionScenario(scenario);

  if (moisAbsolu < 0 || moisAbsolu >= horizonMois) {
    throw new BusinessRuleError(
      `Le mois ${moisAbsolu} est hors de l'horizon du plan (mois valides : 0 a ${horizonMois - 1}).`,
      422
    );
  }

  return prisma.$transaction(async (tx) => {
    const dejaCloture = await tx.clotureMois.findUnique({
      where: { scenarioId_moisAbsolu: { scenarioId, moisAbsolu } },
    });
    if (dejaCloture) {
      throw new BusinessRuleError(
        `Le mois ${moisAbsolu} de ce scenario est deja cloture (le ${dejaCloture.dateCloture.toISOString()}). Une cloture ne peut pas etre repetee.`,
        409
      );
    }

    const versionActive = await tx.mappingRapprochement.findFirst({
      where: { siteId, actif: true },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const versionMapping = versionActive?.version ?? 0;

    return tx.clotureMois.create({
      data: {
        scenarioId,
        moisAbsolu,
        clotureeParId,
        siteId,
        versionMapping,
      },
    });
  });
}

/**
 * Garde reutilisable — a appeler par TOUTE future route d'ECRITURE portant
 * sur le rapprochement d'un mois donne (ADR-053 §3.10 : « verrouille, cote
 * API, toute ecriture de rapprochement portant sur ce mois pour ce
 * scenario »). Aucune route d'ecriture de rapprochement n'existe encore
 * dans le depot a la date de cette story (le rapprochement est strictement
 * en lecture seule, ADR-053 §5) — cette fonction est le point d'application
 * pret pour la premiere qui en aura besoin, pas un mecanisme mort : elle
 * est deja exercee indirectement par `cloturerMois` ci-dessus (une
 * deuxieme cloture EST une ecriture sur un mois deja cloture).
 *
 * @throws {BusinessRuleError} (409) si ce mois est deja cloture pour ce scenario
 */
export async function assertMoisNonCloture(scenarioId: string, siteId: string, moisAbsolu: number) {
  const cloture = await prisma.clotureMois.findFirst({
    where: { scenarioId, siteId, moisAbsolu },
    select: { id: true, dateCloture: true },
  });
  if (cloture) {
    throw new BusinessRuleError(
      `Le mois ${moisAbsolu} de ce scenario est cloture depuis le ${cloture.dateCloture.toISOString()} — toute ecriture portant sur ce mois est verrouillee.`,
      409
    );
  }
}

/**
 * src/lib/queries/previsions-snapshot-budget.ts
 *
 * Queries Prisma — `SnapshotBudgetInitial` (Sprint PR3, story PR3.3).
 * Reference ADR-053, section 15.2 (amendement Sprint PR3).
 *
 * R8 : `siteId` filtre sur CHAQUE lecture/ecriture.
 * R4 : `activerScenarioAvecSnapshot` cree TOUTES les lignes du snapshot ET
 *      fait passer `ScenarioPrevision.statut` a `ACTIF` dans LA MEME
 *      transaction Prisma — jamais deux ecritures separees (ADR-053 §15.2 :
 *      "dans la meme transaction que le passage de statut a ACTIF").
 * Immuabilite : aucune fonction de ce fichier n'expose d'UPDATE ni de
 *      DELETE sur `SnapshotBudgetInitial` — seule la suppression en cascade
 *      du scenario (`onDelete: Cascade`, gere par Postgres) peut faire
 *      disparaitre un snapshot. Une seconde tentative d'activation du meme
 *      scenario est refusee AVANT toute ecriture (garde explicite) — a
 *      defaut, la contrainte `@@unique([scenarioId, moisAbsolu, posteId,
 *      categorie])` l'empecherait de toute facon au niveau base, mais avec
 *      un message d'erreur Postgres brut au lieu d'un message metier clair.
 *
 * Source du calcul : `calculerProjectionScenario` (le moteur de production,
 * `src/lib/previsions/route-orchestration.ts`) et `calculerChargesMensuelles`
 * (`src/lib/previsions/charges.ts`, Etape 5 du moteur) — JAMAIS une
 * reimplementation locale des formules (ADR-053 §15.2/§15.6 : "le snapshot
 * n'est pas un nouveau calcul, c'est une capture de la sortie du calcul
 * existant").
 *
 * Ce module N'ECRIT JAMAIS dans une table du domaine reel (`Depense`,
 * `Vente`, `MouvementStock`, ...) — ADR-053 §5.1(a)/§15.6.
 */
import { prisma } from "@/lib/db";
import { StatutScenarioPrevision } from "@/types";
import { BusinessRuleError } from "@/lib/errors";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import { calculerChargesMensuelles } from "@/lib/previsions/charges";
import type { ChargeMensuelleInput } from "@/lib/previsions/charges";

/** Categories agregees (posteId = null) — jamais recalculees depuis une relation vivante. */
const CATEGORIE_ALIMENT = "ALIMENT";
const CATEGORIE_ALEVINS = "ALEVINS";
const CATEGORIE_INVESTISSEMENT = "INVESTISSEMENT";
const CATEGORIE_APPORT_CAPITAL = "APPORT_CAPITAL";
const CATEGORIE_REVENU_VENTE = "REVENU_VENTE";
/**
 * Categorie portant le solde de tresorerie CUMULE projete a l'activation
 * (posteId = null) — c'est la ligne que consomme la vue tresorerie a 3
 * series (Sprint PR3-ter, story B.3, ADR-053 §15.2) comme serie BUDGET
 * INITIAL. EXPORTEE pour eviter qu'un second module ne redeclare ce
 * litteral en dur (une seule source de verite pour ce nom de categorie) —
 * voir `src/lib/queries/previsions-tresorerie-trois-series.ts`.
 */
export const CATEGORIE_TRESORERIE_SOLDE = "TRESORERIE_SOLDE";

interface LigneSnapshotACreer {
  moisAbsolu: number;
  posteId: string | null;
  categorie: string;
  montantFCFA: string;
}

/**
 * Construit l'ensemble des lignes du snapshot budget initial pour un
 * scenario deja charge (`ScenarioPourCalcul`) — fonction de composition
 * PURE (aucun I/O), separee de la persistance (`activerScenarioAvecSnapshot`
 * ci-dessous), pour rester testable par simple comparaison de sortie.
 *
 * Granularite (ADR-053 §15.2) :
 * - une ligne par (poste x mois) issue de `ChargeMensuellePrevue`, via
 *   `calculerChargesMensuelles` (moteur, Etape 5) — jamais une lecture
 *   directe non filtree des lignes brutes ;
 * - une ligne agregee par mois pour chaque grandeur globale qui n'a pas de
 *   PostePrevision propre (aliment, alevins, investissements hors charges,
 *   apports, revenu de vente, solde de tresorerie projete cumule) — issues
 *   de `calculerProjectionScenario` (le meme moteur qui alimente deja
 *   l'onglet tableau de bord existant, ADR-053 §15.2).
 */
export function construireLignesSnapshotBudgetInitial(
  scenario: Awaited<ReturnType<typeof chargerScenarioPourMoteur>>
): LigneSnapshotACreer[] {
  const projection = calculerProjectionScenario(scenario);

  const chargesInput: ChargeMensuelleInput[] = scenario.postes.flatMap((poste) =>
    poste.chargesMensuelles.map((charge) => ({
      posteId: charge.posteId,
      moisAbsolu: charge.moisAbsolu,
      montantFCFA: charge.montantFCFA,
    }))
  );
  const libellesParPoste = new Map(scenario.postes.map((poste) => [poste.id, poste.libelle]));

  const lignes: LigneSnapshotACreer[] = [];

  for (const mois of projection.mois) {
    const { parPoste } = calculerChargesMensuelles(chargesInput, mois.moisAbsolu);
    for (const charge of parPoste) {
      lignes.push({
        moisAbsolu: mois.moisAbsolu,
        posteId: charge.posteId,
        categorie: libellesParPoste.get(charge.posteId) ?? charge.posteId,
        montantFCFA: charge.montantFCFA.toString(),
      });
    }

    lignes.push(
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_ALIMENT,
        montantFCFA: mois.coutAlimentsFCFA.toString(),
      },
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_ALEVINS,
        montantFCFA: mois.coutAlevinsFCFA.toString(),
      },
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_INVESTISSEMENT,
        montantFCFA: mois.investissementsFCFA.toString(),
      },
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_APPORT_CAPITAL,
        montantFCFA: mois.apportsFCFA.toString(),
      },
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_REVENU_VENTE,
        montantFCFA: mois.revenusFCFA.toString(),
      },
      {
        moisAbsolu: mois.moisAbsolu,
        posteId: null,
        categorie: CATEGORIE_TRESORERIE_SOLDE,
        montantFCFA: mois.soldeFCFA.toString(),
      }
    );
  }

  return lignes;
}

/**
 * Active un scenario ET fige son `SnapshotBudgetInitial` dans LA MEME
 * transaction (R4, ADR-053 §15.2) : `ScenarioPrevision.statut` ne passe a
 * `ACTIF` que si le snapshot complet a pu etre ecrit, et reciproquement —
 * jamais un scenario `ACTIF` sans budget initial fige, jamais un snapshot
 * orphelin d'un scenario reste `BROUILLON`.
 *
 * Refuse explicitement une deuxieme activation (ADR-053 §15.2 : "un
 * scenario ne peut etre active qu'une seule fois dans son cycle de vie") —
 * la garde est faite AVANT tout calcul/ecriture, dans la transaction, pour
 * eviter une fenetre de concurrence entre la lecture et l'ecriture.
 *
 * @throws {BusinessRuleError} (404) si le scenario est introuvable pour ce site (R8)
 * @throws {BusinessRuleError} (409) si le scenario porte deja un snapshot (deja active)
 */
export async function activerScenarioAvecSnapshot(scenarioId: string, siteId: string) {
  const scenario = await chargerScenarioPourMoteur(scenarioId, siteId);
  const lignes = construireLignesSnapshotBudgetInitial(scenario);

  return prisma.$transaction(async (tx) => {
    const snapshotExistant = await tx.snapshotBudgetInitial.count({
      where: { scenarioId },
    });
    if (snapshotExistant > 0) {
      throw new BusinessRuleError(
        "Ce scenario a deja ete active : un budget initial est deja fige (immuable, un scenario ne s'active qu'une seule fois dans son cycle de vie).",
        409
      );
    }

    const { count } = await tx.scenarioPrevision.updateMany({
      where: { id: scenarioId, siteId },
      data: { statut: StatutScenarioPrevision.ACTIF },
    });
    if (count === 0) {
      throw new BusinessRuleError("Scenario introuvable.", 404);
    }

    if (lignes.length > 0) {
      await tx.snapshotBudgetInitial.createMany({
        data: lignes.map((ligne) => ({
          scenarioId,
          moisAbsolu: ligne.moisAbsolu,
          posteId: ligne.posteId,
          categorie: ligne.categorie,
          montantFCFA: ligne.montantFCFA,
          siteId,
        })),
      });
    }

    return tx.scenarioPrevision.findUniqueOrThrow({ where: { id: scenarioId } });
  });
}

/**
 * Lit le `SnapshotBudgetInitial` d'un scenario — lecture pure, aucune
 * ecriture. Filtre `siteId` (R8). Filtre optionnel sur un seul mois (evite
 * de tout charger pour une vue mensuelle).
 */
export async function getSnapshotBudgetInitial(
  scenarioId: string,
  siteId: string,
  moisAbsolu?: number
) {
  return prisma.snapshotBudgetInitial.findMany({
    where: {
      scenarioId,
      siteId,
      ...(moisAbsolu !== undefined && { moisAbsolu }),
    },
    orderBy: [{ moisAbsolu: "asc" }, { categorie: "asc" }],
  });
}

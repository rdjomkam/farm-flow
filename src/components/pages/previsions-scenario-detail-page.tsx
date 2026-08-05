import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getScenarioById } from "@/lib/queries/previsions-scenarios";
import { getAlimentsPrevisionParScenario } from "@/lib/queries/previsions-aliments";
import { getVaguesPrevuesParScenario } from "@/lib/queries/previsions-vagues";
import {
  getPostesPrevisionParScenario,
  getChargesMensuellesParScenario,
  getJournalDepensesParScenario,
  getApportsCapitalParScenario,
} from "@/lib/queries/previsions-charges";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import { chargerRapprochementScenario } from "@/lib/queries/previsions-vue-rapprochement";
import { construireRapprochementDTO } from "@/components/previsions/rapprochement-dto";
import type { RapprochementScenarioDTO } from "@/components/previsions/rapprochement-types";
import type { Decimal } from "@/lib/previsions/decimal-config";
import { prisma } from "@/lib/db";
import {
  Permission,
  StatutScenarioPrevision,
  StatutVaguePrevue,
  TypePostePrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
  TailleGranule,
} from "@/types";
import { decimalToNumber } from "@/lib/previsions/decimal-io";
import type { Prisma } from "@/generated/prisma/client";
import { ScenarioDetailClient } from "@/components/previsions/scenario-detail-client";
import type {
  ScenarioPrevisionDetailDTO,
  AlimentPrevisionDTO,
  VaguePrevueListItemDTO,
  PostePrevisionDTO,
  ChargeMensuellePrevueDTO,
  JournalDepensePrevueDTO,
  ApportCapitalDTO,
  VagueCandidateDTO,
} from "@/components/previsions/api-types";
import type { ProjectionScenarioDTO } from "@/components/previsions/projection-types";

/**
 * `decimal.js` (moteur) -> `number`, a la frontiere Server -> Client — meme
 * regle que `n()` de `GET /api/previsions/scenarios/[id]/calculer`
 * (route-level), reprise ici cote page puisque cette page appelle le
 * moteur directement (jamais un `fetch` vers sa propre API, story PR2.4).
 */
function n(value: Decimal): number {
  return value.toNumber();
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page Server — detail d'un scenario de prevision : tableau de bord, vue
 * mensuelle (story PR2.4), parametres, granulometries, plan des vagues,
 * charges, journal, apports (story PR2.3). Toutes les donnees sont
 * chargees directement via les queries Prisma et le moteur de calcul
 * (jamais un fetch vers sa propre API), converties en JSON simple
 * (`Decimal` -> `number`, cf. `decimalToNumber` / `n()`) AVANT d'etre
 * passees au Client Component — un `Decimal` (Prisma ou `decimal.js`, une
 * instance de classe dans les deux cas) ne peut pas traverser la frontiere
 * Server->Client de Next.js.
 */
export default async function PrevisionsScenarioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PREVISIONS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("previsions");
  const siteId = session.activeSiteId;

  const [scenario, aliments, vaguesPrevues, postes, charges, journal, apports, vaguesCandidates] =
    await Promise.all([
      getScenarioById(id, siteId),
      getAlimentsPrevisionParScenario(id, siteId),
      getVaguesPrevuesParScenario(id, siteId, { withAliments: true }),
      getPostesPrevisionParScenario(id, siteId),
      getChargesMensuellesParScenario(id, siteId),
      getJournalDepensesParScenario(id, siteId),
      getApportsCapitalParScenario(id, siteId),
      prisma.vague.findMany({
        where: { siteId },
        select: { id: true, code: true, statut: true, vaguePrevueId: true },
        orderBy: { dateDebut: "desc" },
        take: 200,
      }),
    ]);

  if (!scenario) notFound();

  const PROJECTION_VIDE: ProjectionScenarioDTO = {
    horizonMois: 0,
    mois: [],
    vagues: [],
    pointBas: null,
    budget: {
      totalCoutsProductionFCFA: 0,
      totalChargesHorsProductionFCFA: 0,
      totalApportsFCFA: 0,
      budgetTotalFCFA: 0,
    },
  };

  const RAPPROCHEMENT_VIDE: RapprochementScenarioDTO = {
    horizonMois: 0,
    dateDebutPlan: scenario.dateDebutPlan.toISOString(),
    moisDisponibles: [],
    lignesParMois: {},
    totalMoisParMois: {},
    nonRapprocheParMois: {},
    cumuleGlobalParMois: {},
    cumuleParPosteParMois: {},
    topEcartsParMois: {},
    vagues: [],
    calculeLe: new Date().toISOString(),
  };

  /**
   * Story PR2.4 : la projection complete de l'horizon (tableau de bord +
   * vue mensuelle) alimente `calculerProjectionScenario` directement,
   * jamais via un `fetch` vers `/api/previsions/scenarios/[id]/calculer`
   * (patron du depot, cf. finances/page.tsx). `calculerProjectionScenario`
   * peut lever une erreur explicite (ex. `sacsParTonneStandard` non
   * configure pour une granulometrie utilisee, GAP 1 de
   * `route-orchestration.ts`) — la page ne doit jamais planter pour
   * autant : repli sur une projection vide. Mais un repli vide ne doit
   * JAMAIS se faire passer pour l'etat "donnees reellement absentes" —
   * cf. finding de review PR2.4 : les messages "aucune vague ni charge
   * saisie" / "plan deja entierement passe" laissent croire a un probleme
   * de saisie ou un plan perime, alors que la cause reelle peut etre une
   * erreur de CONFIGURATION (ex. granulometrie sans `sacsParTonneStandard`).
   * `erreurProjection` porte le message reel de l'exception (jamais un
   * texte generique) jusqu'aux onglets Tableau de bord et Previsions, qui
   * l'affichent dans un etat dedie, distinct de l'etat "vide" legitime.
   */
  const {
    projection,
    erreurProjection,
    rapprochement,
  }: {
    projection: ProjectionScenarioDTO;
    erreurProjection: string | null;
    rapprochement: RapprochementScenarioDTO;
  } = await (async () => {
      try {
        const scenarioPourCalcul = await chargerScenarioPourMoteur(id, siteId);
        const p = calculerProjectionScenario(scenarioPourCalcul);
        const projectionCalculee: ProjectionScenarioDTO = {
          horizonMois: p.horizonMois,
          mois: p.mois.map((m) => ({
            moisAbsolu: m.moisAbsolu,
            revenusFCFA: n(m.revenusFCFA),
            coutAlimentsFCFA: n(m.coutAlimentsFCFA),
            coutAlevinsFCFA: n(m.coutAlevinsFCFA),
            baseRepartitionFCFA: n(m.baseRepartitionFCFA),
            investissementsFCFA: n(m.investissementsFCFA),
            depensesFCFA: n(m.depensesFCFA),
            apportsFCFA: n(m.apportsFCFA),
            resultatFCFA: n(m.resultatFCFA),
            epargneFCFA: n(m.epargneFCFA),
            soldeFCFA: n(m.soldeFCFA),
            empoissonneKg: n(m.empoissonneKg),
            ventesKg: n(m.ventesKg),
            alevinsACommanderNb: n(m.alevinsACommanderNb),
            besoinAlimentsTotalKg: n(m.besoinAlimentsTotalKg),
            sacsAlimentsTotal: m.sacsAlimentsTotal,
            sacsParGranulometrie: m.sacsParGranulometrie,
            detailParVagueSacs: m.detailParVagueSacs,
            logistique: {
              voyagesAliments: m.logistique.voyagesAliments,
              voyagesPoissons: m.logistique.voyagesPoissons,
              voyagesAlevins: m.logistique.voyagesAlevins,
              sousTotalFCFA: n(m.logistique.sousTotalFCFA),
            },
          })),
          vagues: p.vagues.map((v) => ({
            vaguePrevueId: v.vaguePrevueId,
            code: v.code,
            statut: v.statut,
            moisStockageAbsolu: v.moisStockageAbsolu,
            moisRecolteAbsolu: v.moisRecolteAbsolu,
            coutAlimentFCFA: n(v.coutAlimentFCFA),
            coutAlevinsFCFA: n(v.coutAlevinsFCFA),
            quotePartChargesFCFA: n(v.quotePartChargesFCFA),
            coutProductionFCFA: n(v.coutProductionFCFA),
            revenuPrevuFCFA: n(v.revenuPrevuFCFA),
            biomasseKg: n(v.biomasseKg),
            alimentsParMois: v.alimentsParMois.map((a) => ({
              alimentPrevisionId: a.alimentPrevisionId,
              moisCycle: a.moisCycle,
              moisAbsolu: a.moisAbsolu,
              quantiteKg: n(a.quantiteKg),
              sacs: a.sacs,
              montantFCFA: n(a.montantFCFA),
            })),
          })),
          pointBas: p.pointBas
            ? { pointBasFCFA: n(p.pointBas.pointBasFCFA), moisAbsolu: p.pointBas.moisAbsolu }
            : null,
          budget: {
            totalCoutsProductionFCFA: n(p.budget.totalCoutsProductionFCFA),
            totalChargesHorsProductionFCFA: n(p.budget.totalChargesHorsProductionFCFA),
            totalApportsFCFA: n(p.budget.totalApportsFCFA),
            budgetTotalFCFA: n(p.budget.budgetTotalFCFA),
          },
        };

        /**
         * Rapprochement prevu/reel (story PR3.7, ADR-053 section 15) —
         * reutilise `scenarioPourCalcul`/`p` DEJA charges/calcules
         * ci-dessus (jamais un second appel independant a
         * `chargerScenarioPourMoteur`/`calculerProjectionScenario`, qui
         * pourrait diverger, ADR-053 section 15.6 point 1). Un echec de ce
         * calcul specifique ne doit jamais invalider la projection deja
         * calculee avec succes — capture separement, l'onglet
         * Rapprochement affiche alors son propre etat vide/erreur.
         */
        let rapprochementCalcule = RAPPROCHEMENT_VIDE;
        try {
          const vue = await chargerRapprochementScenario(id, siteId, scenarioPourCalcul, p);
          rapprochementCalcule = construireRapprochementDTO(vue, scenario.dateDebutPlan.toISOString());
        } catch {
          // rapprochementCalcule reste RAPPROCHEMENT_VIDE — l'onglet gere son propre etat vide.
        }

        return { projection: projectionCalculee, erreurProjection: null, rapprochement: rapprochementCalcule };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("page.errors.projectionUnknown");
        return { projection: PROJECTION_VIDE, erreurProjection: message, rapprochement: RAPPROCHEMENT_VIDE };
      }
    })();

  const scenarioDetail: ScenarioPrevisionDetailDTO = {
    id: scenario.id,
    code: scenario.code,
    nom: scenario.nom,
    description: scenario.description,
    dureeCycleMois: scenario.dureeCycleMois,
    dateDebutPlan: scenario.dateDebutPlan.toISOString(),
    statut: scenario.statut as StatutScenarioPrevision,
    userId: scenario.userId,
    siteId: scenario.siteId,
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString(),
    parametres: scenario.parametres
      ? {
          id: scenario.parametres.id,
          scenarioId: scenario.parametres.scenarioId,
          effectifAlevinsParVague: scenario.parametres.effectifAlevinsParVague,
          margeSecuriteAlevinsPct: decimalToNumber(scenario.parametres.margeSecuriteAlevinsPct),
          poidsMoyenInitialG: decimalToNumber(scenario.parametres.poidsMoyenInitialG),
          poidsObjectifG: decimalToNumber(scenario.parametres.poidsObjectifG),
          prixAlevinUnitaireFCFA: decimalToNumber(scenario.parametres.prixAlevinUnitaireFCFA),
          prixVenteKgFCFA: decimalToNumber(scenario.parametres.prixVenteKgFCFA),
          nombreBacsSimultanesCible: scenario.parametres.nombreBacsSimultanesCible,
          frequenceStockageMois: decimalToNumber(scenario.parametres.frequenceStockageMois),
          capaciteTransportAlimentsSacs: scenario.parametres.capaciteTransportAlimentsSacs ?? null,
          coutTransportAlimentsFCFA: decimalToNumber(scenario.parametres.coutTransportAlimentsFCFA),
          capaciteTransportPoissonsKg: scenario.parametres.capaciteTransportPoissonsKg ?? null,
          coutTransportPoissonsFCFA: decimalToNumber(scenario.parametres.coutTransportPoissonsFCFA),
          capaciteTransportAlevinsNb: scenario.parametres.capaciteTransportAlevinsNb ?? null,
          coutTransportAlevinsFCFA: decimalToNumber(scenario.parametres.coutTransportAlevinsFCFA),
          tauxEpargnePct: decimalToNumber(scenario.parametres.tauxEpargnePct),
          alevinsAchetesParDefaut: scenario.parametres.alevinsAchetesParDefaut,
        }
      : null,
    paliersRemise: scenario.paliersRemise.map((p) => ({
      id: p.id,
      scenarioId: p.scenarioId,
      seuilTonnes: decimalToNumber(p.seuilTonnes),
      pourcentageRemise: decimalToNumber(p.pourcentageRemise),
      ordre: p.ordre,
      siteId: p.siteId,
    })),
  };

  const alimentsDto: AlimentPrevisionDTO[] = aliments.map((a) => ({
    id: a.id,
    scenarioId: a.scenarioId,
    tailleGranule: a.tailleGranule as TailleGranule,
    sacsParTonneStandard: decimalToNumber(a.sacsParTonneStandard),
    ordre: a.ordre,
    siteId: a.siteId,
    repartitions: a.repartitions.map((r) => ({
      id: r.id,
      alimentPrevisionId: r.alimentPrevisionId,
      moisCycle: r.moisCycle,
      pourcentage: decimalToNumber(r.pourcentage),
      siteId: r.siteId,
    })),
    articles: a.articles.map((art) => ({
      id: art.id,
      alimentCalibrePrevisionId: art.alimentCalibrePrevisionId,
      produitId: art.produitId,
      libelle: art.libelle,
      poidsSacKg: decimalToNumber(art.poidsSacKg),
      prixSacFCFA: decimalToNumber(art.prixSacFCFA),
      sacsParTonneUnitaire: decimalToNumber(art.sacsParTonneUnitaire),
      partApprovisionnementPct: decimalToNumber(art.partApprovisionnementPct),
      ordre: art.ordre,
      siteId: art.siteId,
    })),
  }));

  const vaguesPrevuesDto: VaguePrevueListItemDTO[] = vaguesPrevues.map((v) => ({
    id: v.id,
    scenarioId: v.scenarioId,
    code: v.code,
    dateStockagePrevue: v.dateStockagePrevue.toISOString(),
    effectifAlevinsPrevu: v.effectifAlevinsPrevu,
    poidsMoyenInitialG: decimalToNumber(v.poidsMoyenInitialG),
    dureeCycleMoisFigee: v.dureeCycleMoisFigee,
    statut: v.statut as StatutVaguePrevue,
    vaguePrevueParentId: v.vaguePrevueParentId,
    siteId: v.siteId,
    alevinsAchetes: v.alevinsAchetes,
    alimentsParMois: (
      (
        v as typeof v & {
          alimentsParMois?: {
            id: string;
            vaguePrevueId: string;
            alimentPrevisionId: string;
            moisCycle: number;
            sacsCalcules: number;
            sacsSaisis: number | null;
            quantiteKgCalculee: Prisma.Decimal;
            coutCalculeFCFA: Prisma.Decimal;
            siteId: string;
          }[];
        }
      ).alimentsParMois ?? []
    ).map((l) => ({
      id: l.id,
      vaguePrevueId: l.vaguePrevueId,
      alimentPrevisionId: l.alimentPrevisionId,
      moisCycle: l.moisCycle,
      sacsCalcules: l.sacsCalcules,
      sacsSaisis: l.sacsSaisis,
      quantiteKgCalculee: decimalToNumber(l.quantiteKgCalculee),
      coutCalculeFCFA: decimalToNumber(l.coutCalculeFCFA),
      siteId: l.siteId,
    })),
  }));

  const postesDto: PostePrevisionDTO[] = postes.map((p) => ({
    id: p.id,
    scenarioId: p.scenarioId,
    libelle: p.libelle,
    type: p.type as TypePostePrevision,
    inclusBaseRepartition: p.inclusBaseRepartition,
    ordre: p.ordre,
    siteId: p.siteId,
  }));

  const chargesDto: ChargeMensuellePrevueDTO[] = charges.map((c) => ({
    id: c.id,
    scenarioId: c.scenarioId,
    posteId: c.posteId,
    moisAbsolu: c.moisAbsolu,
    montantFCFA: decimalToNumber(c.montantFCFA),
    siteId: c.siteId,
  }));

  const journalDto: JournalDepensePrevueDTO[] = journal.map((j) => ({
    id: j.id,
    scenarioId: j.scenarioId,
    date: j.date.toISOString(),
    libelle: j.libelle,
    categorie: j.categorie as CategorieJournalPrevu,
    montantFCFA: decimalToNumber(j.montantFCFA),
    vaguePrevueId: j.vaguePrevueId,
    siteId: j.siteId,
  }));

  const apportsDto: ApportCapitalDTO[] = apports.map((a) => ({
    id: a.id,
    scenarioId: a.scenarioId,
    date: a.date.toISOString(),
    libelle: a.libelle,
    montantFCFA: decimalToNumber(a.montantFCFA),
    type: a.type as TypeApportCapital,
    siteId: a.siteId,
  }));

  const vaguesCandidatesDto: VagueCandidateDTO[] = vaguesCandidates.map((v) => ({
    id: v.id,
    code: v.code,
    statut: v.statut,
    vaguePrevueId: v.vaguePrevueId ?? null,
  }));

  return (
    <>
      <Header title={scenario.nom} />
      <div className="p-4 md:p-6">
        <ScenarioDetailClient
          scenario={scenarioDetail}
          initialAliments={alimentsDto}
          initialVaguesPrevues={vaguesPrevuesDto}
          initialPostes={postesDto}
          initialCharges={chargesDto}
          initialJournal={journalDto}
          initialApports={apportsDto}
          vaguesCandidates={vaguesCandidatesDto}
          permissions={permissions}
          projection={projection}
          erreurProjection={erreurProjection}
          rapprochement={rapprochement}
        />
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container, Calendar, Fish, Scissors, Plus } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { PoidsChart } from "@/components/vagues/poids-chart";
import { RelevesList } from "@/components/vagues/releves-list";
import { VagueActionMenu } from "@/components/vagues/vague-action-menu";
import { VagueBacsSection } from "@/components/vagues/vague-bacs-section";
import { VagueBacsTimeline } from "@/components/vagues/vague-bacs-timeline";
import { AccessDenied } from "@/components/ui/access-denied";
import { CalibragesList } from "@/components/calibrage/calibrages-list";
import { CoutProductionCard } from "@/components/vagues/cout-production-card";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { getReleves } from "@/lib/queries/releves";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { getCalibrages } from "@/lib/queries/calibrages";
import { getCoutProductionVague } from "@/lib/queries/finances";
import { prisma } from "@/lib/db";
import { computeVivantsByBac } from "@/lib/calculs";
import { computeBacPerformance } from "@/lib/bac-performance";
import { BacPerformanceSection } from "@/components/vagues/bac-performance-section";
import { formatNum } from "@/lib/format";
import { genererCourbeGompertz, calibrerGompertz, isCachedGompertzValid, mergeLockedCurve, buildDisplayCurve, type LockedCurve } from "@/lib/gompertz";
import { StatutVague, StatutVente, TypeReleve, CategorieProduit, Permission, TypeVague } from "@/types";
import { getLineage, getTransfertDestBacIds } from "@/lib/queries/transferts";
import type { Bac, BacResponse, Releve, EvolutionPoidsPoint, IndicateursVague as IndicateursType, CalibrageWithRelations, AssignationBacForVague } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";

const statutVariants: Record<StatutVague, "en_cours" | "terminee" | "annulee"> = {
  [StatutVague.EN_COURS]: "en_cours",
  [StatutVague.TERMINEE]: "terminee",
  [StatutVague.ANNULEE]: "annulee",
};

export default async function VagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("vagues");
  const locale = await getLocale();

  const { id } = await params;
  const [vague, biometriesData, relevesPreview, indicateurs, produitsDb, calibragesDb, gompertzRecord, configElevages, assignationsDb, coutProduction, unitesProduction, ventesAggregate, lineageData, clientsForVente] = await Promise.all([
    getVagueById(id, session.activeSiteId),
    // Biometries pour le graphique — select restreint (ADR-038 A-D2)
    prisma.releve.findMany({
      where: { vagueId: id, siteId: session.activeSiteId, typeReleve: TypeReleve.BIOMETRIE },
      orderBy: { date: "asc" },
      select: { typeReleve: true, date: true, poidsMoyen: true, bacId: true },
    }),
    // 3 derniers relevés pour la preview (ADR-038 A-D2)
    getReleves(session.activeSiteId, { vagueId: id }, { limit: 3, offset: 0 }),
    getIndicateursVague(session.activeSiteId, id),
    prisma.produit.findMany({
      where: {
        siteId: session.activeSiteId,
        isActive: true,
        categorie: { in: [CategorieProduit.ALIMENT, CategorieProduit.INTRANT] },
      },
      select: { id: true, nom: true, categorie: true, unite: true, stockActuel: true },
      orderBy: { nom: "asc" },
    }),
    getCalibrages(session.activeSiteId, { vagueId: id }),
    prisma.gompertzVague.findUnique({ where: { vagueId: id } }),
    prisma.configElevage.findMany({
      where: { siteId: session.activeSiteId },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    // ADR-043 Phase 2: charger toutes les assignations de cette vague pour VagueBacsSection
    prisma.assignationBac.findMany({
      where: { vagueId: id, siteId: session.activeSiteId },
      include: { bac: { select: { id: true, nom: true, volume: true } } },
      orderBy: { dateAssignation: "asc" },
    }),
    // Coût de production — erreur non-bloquante : on attrape pour éviter de crasher la page
    getCoutProductionVague(id, session.activeSiteId).catch(() => null),
    prisma.uniteProduction.findMany({
      where: { siteId: session.activeSiteId, isActive: true },
      select: { id: true, code: true, nom: true, type: true },
      orderBy: { nom: "asc" },
    }),
    // Total vendu (kg) pour les barres de progression — via LigneVente (source de vérité par vague)
    prisma.ligneVente.aggregate({
      where: {
        vagueId: id,
        siteId: session.activeSiteId,
        vente: { statut: { in: [StatutVente.LIVREE, StatutVente.CLOTUREE] } },
      },
      _sum: { poidsTotalKg: true },
    }),
    // Lineage — vagues parentes via TransfertGroupe (pour afficher le toggle "Inclure PG")
    getLineage(session.activeSiteId, id, 5).catch(() => ({ vagueId: id, parents: [] })),
    // Clients du site pour VenteAlevinsDialog (systeme en premier — VA.4)
    prisma.client.findMany({
      where: { siteId: session.activeSiteId, isActive: true },
      select: { id: true, nom: true, isSysteme: true },
      orderBy: [{ isSysteme: "desc" }, { nom: "asc" }],
    }),
  ]);

  if (!vague) notFound();

  const hasIncomingTransferts = lineageData.parents.length > 0;

  const totalVenduKg = ventesAggregate._sum.poidsTotalKg ?? 0;

  // Fetch poidsObjectif from ConfigElevage if linked to this vague
  const configElevage = vague.configElevageId
    ? await prisma.configElevage.findUnique({
        where: { id: vague.configElevageId },
        select: { poidsObjectif: true, gompertzMinPoints: true, gompertzWInfDefault: true },
      })
    : null;
  const poidsObjectif = configElevage?.poidsObjectif ?? 800;
  const gompertzMinPoints = configElevage?.gompertzMinPoints ?? 5;

  const statut = vague.statut as StatutVague;
  const isEnCours = statut === StatutVague.EN_COURS;

  const defaultIndicateurs: IndicateursType = {
    tauxSurvie: null,
    fcr: null,
    sgr: null,
    biomasse: null,
    poidsMoyen: null,
    tailleMoyenne: null,
    nombreVivants: null,
    totalMortalites: 0,
    totalAliment: 0,
    gainPoids: null,
    joursEcoules: 0,
  };

  // Build chart data from biometrie releves — aggregate by date (weighted avg across bacs)
  // Note: vivantsByBac needs mortalite + comptage releves — load them separately (ADR-038 A-D2)
  // Single query for both vivants calculation and bac performance (superset of fields)
  const relevesForPerf = await prisma.releve.findMany({
    where: { vagueId: id, siteId: session.activeSiteId },
    orderBy: { date: "asc" },
    select: {
      bacId: true,
      typeReleve: true,
      date: true,
      poidsMoyen: true,
      nombreMorts: true,
      nombreCompte: true,
      nombreVendus: true,
      nombreTransferes: true,
      quantiteAliment: true,
      consommations: {
        select: {
          quantite: true,
          produit: { select: { prixUnitaire: true, unite: true, uniteAchat: true, contenance: true } },
        },
      },
    },
  });
  // CS.2 : charger les bacDestIds pour discriminer TRANSFERT entrants (vague GROSSISSEMENT)
  const transfertDestBacIds = await getTransfertDestBacIds(session.activeSiteId, id);
  const vivantsByBac = computeVivantsByBac(vague.bacs, relevesForPerf, vague.nombreInitial, { transfertDestBacIds });

  // Compute per-bac performance data
  const bacPerfData = computeBacPerformance({
    bacs: vague.bacs.map((b) => ({ id: b.id, nom: b.nom, nombreInitial: b.nombreInitial })),
    releves: relevesForPerf,
    ventes: [],
    nombreInitialVague: vague.nombreInitial,
    dateDebutVague: new Date(vague.dateDebut),
    poidsMoyenInitial: vague.poidsMoyenInitial,
  });
  const biometries = biometriesData.filter(
    (r) => r.poidsMoyen !== null
  );
  const groupedByDate = new Map<string, typeof biometries>();
  for (const r of biometries) {
    const key = new Date(r.date).toISOString().slice(0, 10);
    const group = groupedByDate.get(key);
    if (group) group.push(r);
    else groupedByDate.set(key, [r]);
  }

  // Gompertz curve — calibrate inline if enough biometry data points.
  // The API route is not called from the page, so we must calibrate server-side here.
  const currentBiometrieCount = groupedByDate.size;

  // Check if cached record is still valid
  const configWInf = configElevage?.gompertzWInfDefault ?? null;
  const cachedIsValid = isCachedGompertzValid(
    gompertzRecord,
    currentBiometrieCount,
    gompertzMinPoints,
    configWInf
  );

  // Inline calibration: run when we have enough points but no valid cache
  let effectiveGompertz: { params: { wInfinity: number; k: number; ti: number }; r2: number; rmse: number; confidenceLevel: string; biometrieCount: number } | null = null;

  if (cachedIsValid && gompertzRecord) {
    effectiveGompertz = {
      params: { wInfinity: gompertzRecord.wInfinity, k: gompertzRecord.k, ti: gompertzRecord.ti },
      r2: gompertzRecord.r2,
      rmse: gompertzRecord.rmse,
      confidenceLevel: gompertzRecord.confidenceLevel,
      biometrieCount: gompertzRecord.biometrieCount,
    };
  } else if (currentBiometrieCount >= gompertzMinPoints) {
    // No valid cache — calibrate inline
    // Normalize to local midnight so same-day biometries count as jour=0
    // (consistent with dateKey + "T00:00:00" parsing used for releve dates)
    const vagueStartDayGompertz = new Date(vague.dateDebut);
    vagueStartDayGompertz.setHours(0, 0, 0, 0);
    const vagueStartMsGompertz = vagueStartDayGompertz.getTime();
    const points = Array.from(groupedByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, releves]) => {
        let sumWeighted = 0;
        let sumWeights = 0;
        for (const r of releves) {
          const weight = (r.bacId ? vivantsByBac.get(r.bacId) : undefined) ?? 1;
          sumWeighted += r.poidsMoyen! * weight;
          sumWeights += weight;
        }
        const dateMs = new Date(dateKey + "T00:00:00").getTime();
        return {
          jour: Math.max(0, Math.floor((dateMs - vagueStartMsGompertz) / (1000 * 60 * 60 * 24))),
          poidsMoyen: Math.round((sumWeighted / sumWeights) * 100) / 100,
        };
      });

    // Fetch initial guess from configElevage if available
    const configForGuess = vague.configElevageId
      ? await prisma.configElevage.findUnique({
          where: { id: vague.configElevageId },
          select: { gompertzWInfDefault: true, gompertzKDefault: true, gompertzTiDefault: true },
        })
      : null;
    const initialGuess: Partial<{ wInfinity: number; k: number; ti: number }> = {};
    if (configForGuess?.gompertzWInfDefault) initialGuess.wInfinity = configForGuess.gompertzWInfDefault;
    if (configForGuess?.gompertzKDefault) initialGuess.k = configForGuess.gompertzKDefault;
    if (configForGuess?.gompertzTiDefault) initialGuess.ti = configForGuess.gompertzTiDefault;

    const result = calibrerGompertz({ points, initialGuess }, gompertzMinPoints);
    if (result) {
      effectiveGompertz = {
        params: result.params,
        r2: result.r2,
        rmse: result.rmse,
        confidenceLevel: result.confidenceLevel,
        biometrieCount: result.biometrieCount,
      };
    }
  }

  const hasGompertz = effectiveGompertz !== null;

  // Compute lastObservationDay for locked curve logic
  // Normalize vagueStart to local midnight so same-day biometries are jour >= 0
  // (consistent with dateKey + "T00:00:00" which parses as local midnight)
  const vagueStartDayUtc = new Date(vague.dateDebut);
  vagueStartDayUtc.setHours(0, 0, 0, 0);
  const vagueStartMsUtc = vagueStartDayUtc.getTime();

  const sortedDateKeys = Array.from(groupedByDate.keys()).sort();
  const lastObsDay = sortedDateKeys.length > 0
    ? Math.max(0, Math.floor((new Date(sortedDateKeys[sortedDateKeys.length - 1] + "T00:00:00").getTime() - vagueStartMsUtc) / 86400000))
    : 0;

  const gompertzByJour = new Map<number, number>();
  if (hasGompertz && effectiveGompertz) {
    const maxJour = Math.max(200, groupedByDate.size > 0
      ? lastObsDay + 30
      : 200
    );
    const freshCurve = genererCourbeGompertz(effectiveGompertz.params, maxJour, 1);

    // Use locked curve from existing record to freeze past predictions
    const existingLocked = (gompertzRecord?.lockedCurve as LockedCurve) ?? null;
    const previousLastObsDay = gompertzRecord?.lastObservationDay ?? null;
    const displayCurve = buildDisplayCurve(existingLocked, freshCurve, lastObsDay);

    for (const pt of displayCurve) {
      gompertzByJour.set(pt.jour, Math.round(pt.poids * 100) / 100);
    }

    // Persist locked curve if calibration happened.
    // Must await: Next.js streaming drops fire-and-forget promises in production,
    // causing the GompertzVague record to lag behind biometries by days.
    if (!cachedIsValid && effectiveGompertz) {
      const newLockedCurve = mergeLockedCurve(existingLocked, previousLastObsDay, freshCurve, lastObsDay);
      await prisma.gompertzVague.upsert({
        where: { vagueId: id },
        create: {
          vagueId: id,
          siteId: session.activeSiteId,
          wInfinity: effectiveGompertz.params.wInfinity,
          k: effectiveGompertz.params.k,
          ti: effectiveGompertz.params.ti,
          r2: effectiveGompertz.r2,
          rmse: effectiveGompertz.rmse,
          biometrieCount: effectiveGompertz.biometrieCount,
          confidenceLevel: effectiveGompertz.confidenceLevel,
          configWInfUsed: configWInf,
          lockedCurve: newLockedCurve,
          lastObservationDay: lastObsDay,
        },
        update: {
          wInfinity: effectiveGompertz.params.wInfinity,
          k: effectiveGompertz.params.k,
          ti: effectiveGompertz.params.ti,
          r2: effectiveGompertz.r2,
          rmse: effectiveGompertz.rmse,
          biometrieCount: effectiveGompertz.biometrieCount,
          confidenceLevel: effectiveGompertz.confidenceLevel,
          configWInfUsed: configWInf,
          lockedCurve: newLockedCurve,
          lastObservationDay: lastObsDay,
          calculatedAt: new Date(),
        },
      });
    }
  }

  // Build observation map: jour -> weighted average poidsMoyen
  // vagueStartMsUtc already normalized to UTC midnight (declared above with lastObsDay)
  const HORIZON_PREDICTION_JOURS = 120;
  const vagueStartMs = vagueStartMsUtc;

  const observationByJour = new Map<number, number>();
  for (const [dateKey, releves] of groupedByDate) {
    let sumWeighted = 0;
    let sumWeights = 0;
    for (const r of releves) {
      const weight = (r.bacId ? vivantsByBac.get(r.bacId) : undefined) ?? 1;
      sumWeighted += r.poidsMoyen! * weight;
      sumWeights += weight;
    }
    const dateMs = new Date(dateKey + "T00:00:00").getTime();
    const jour = Math.max(0, Math.floor((dateMs - vagueStartMs) / 86400000));
    observationByJour.set(jour, Math.round((sumWeighted / sumWeights) * 100) / 100);
  }

  // Dense dataset: one point per day from J0 to horizon
  // Allows tooltip on any day when touching the chart
  const dernierJourObserve = observationByJour.size > 0
    ? Math.max(...observationByJour.keys())
    : 0;
  const joursHorizon = hasGompertz
    ? Math.max(HORIZON_PREDICTION_JOURS, dernierJourObserve + 30)
    : dernierJourObserve;

  const poidsData: EvolutionPoidsPoint[] = [];
  for (let j = 0; j <= joursHorizon; j++) {
    const obs = observationByJour.get(j) ?? null;
    const gompertz = hasGompertz ? (gompertzByJour.get(j) ?? null) : undefined;
    poidsData.push({
      date: new Date(vagueStartMs + j * 86400000).toISOString(),
      poidsMoyen: obs,
      jour: j,
      poidsGompertz: gompertz,
      isPrediction: obs === null && j > dernierJourObserve,
    });
  }

  const nombreBacs = vague.bacs.length;

  // VA.4 — poids moyen suggere par bac (derniere biometrie du bac, sinon moyenne vague)
  const lastPoidsMoyenByBac = new Map<string, number>();
  for (const r of biometriesData) {
    if (r.bacId && r.poidsMoyen != null) lastPoidsMoyenByBac.set(r.bacId, r.poidsMoyen);
  }
  const poidsMoyenVagueFallback = (indicateurs ?? defaultIndicateurs).poidsMoyen ?? vague.poidsMoyenInitial;
  const venteAlevinsBacs = vague.bacs
    .map((b) => ({
      id: b.id,
      nom: b.nom,
      vivants: vivantsByBac.get(b.id) ?? 0,
      poidsMoyenSuggere: lastPoidsMoyenByBac.get(b.id) ?? poidsMoyenVagueFallback,
    }))
    .filter((b) => b.vivants > 0);

  return (
    <>
      <Header title={vague.code} />

      <div className="flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
        {/* Info section */}
        <section className="flex flex-wrap items-center gap-2 border-b border-border pb-3 min-w-0">
          <Badge variant={statutVariants[statut]}>{t(`statuts.${statut}`)}</Badge>
          {vague.type === TypeVague.PRE_GROSSISSEMENT ? (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-secondary/20 text-secondary-foreground border border-secondary/30">
              {t("type.preGrossissement")}
            </span>
          ) : (
            <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {t("type.grossissement")}
            </span>
          )}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(vague.dateDebut).toLocaleDateString(locale)}
            {vague.dateFin && ` — ${new Date(vague.dateFin).toLocaleDateString(locale)}`}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Fish className="h-3.5 w-3.5" />
            {t("detail.alevins", { count: vague.nombreInitial, poids: vague.poidsMoyenInitial })}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Container className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {nombreBacs > 1 ? t("detail.bacs", { count: nombreBacs }) : t("detail.bac", { count: nombreBacs })}
              {nombreBacs > 0 && ` (${vague.bacs.map((b) => b.nom).join(", ")})`}
            </span>
          </div>
          {(isEnCours || permissions.includes(Permission.EXPORT_DONNEES)) && (
            <VagueActionMenu
              vagueId={vague.id}
              vagueCode={vague.code}
              dateDebut={vague.dateDebut}
              dateFin={vague.dateFin}
              nombreInitial={vague.nombreInitial}
              poidsMoyenInitial={vague.poidsMoyenInitial}
              origineAlevins={vague.origineAlevins}
              configElevageId={vague.configElevageId}
              configElevages={configElevages}
              unitesProduction={unitesProduction}
              uniteProductionId={(vague as { uniteProductionId?: string | null }).uniteProductionId ?? null}
              poidsObjectifKg={vague.poidsObjectifKg ?? null}
              permissions={permissions}
              isEnCours={isEnCours}
              canExport={permissions.includes(Permission.EXPORT_DONNEES)}
              hasIncomingTransferts={hasIncomingTransferts}
              currentBacs={vague.bacs as unknown as BacResponse[]}
              vagueType={vague.type as TypeVague}
              venteAlevinsBacs={venteAlevinsBacs}
              venteAlevinsClients={clientsForVente}
              className="ml-auto"
            />
          )}
        </section>

        {/* CTAs — PRE_GROSSISSEMENT en cours */}
        {vague.type === TypeVague.PRE_GROSSISSEMENT && isEnCours && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{t("transferer")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("transfererHint")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vagues/${vague.id}/arrivage/nouveau`}>
                  <Plus className="h-4 w-4" />
                  Ajouter un arrivage
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vagues/${vague.id}/transfert/nouveau`}>
                  {t("transferer")}
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Section "En attente de transfert" — GROSSISSEMENT sans bac assigné
            (vague vide à la création OU alimentée par transfert sans bac dest spécifié) */}
        {vague.type === TypeVague.GROSSISSEMENT && nombreBacs === 0 && isEnCours && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex flex-col gap-2">
            <div>
              <p className="text-sm font-medium">{t("attendreTransfert")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("attendreTransfertHint")}</p>
            </div>
            <Link
              href="/vagues?type=PRE_GROSSISSEMENT"
              className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
            >
              {t("voirVaguesPreGrossissement")}
            </Link>
          </div>
        )}

        {/* Indicateurs */}
        <IndicateursCards indicateurs={indicateurs ?? defaultIndicateurs} />

        {/* Progress bars — production vs objectif + ventes */}
        {(() => {
          const biomasse = (indicateurs ?? defaultIndicateurs).biomasse ?? 0;
          const biomasseTransferee = coutProduction?.resume?.biomasseTransferee ?? 0;
          const totalProduction = biomasse + totalVenduKg + biomasseTransferee;
          const poidsObj = vague.poidsObjectifKg;
          const showObjectif = poidsObj != null && poidsObj > 0;
          const showVentes = totalVenduKg > 0;

          if (!showObjectif && !showVentes) return null;

          return (
            <div className="flex flex-col gap-3">
              {showObjectif && (() => {
                const pct = Math.round((totalProduction / poidsObj!) * 100);
                return (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{t("progress.objectifLabel")}</span>
                      <span>{formatNum(totalProduction, 1)} / {formatNum(poidsObj!, 0)} kg</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-green transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct}%</p>
                  </div>
                );
              })()}
              {showVentes && (() => {
                const pct = Math.round((totalVenduKg / (totalProduction || 1)) * 100);
                return (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{t("progress.ventesLabel")}</span>
                      <span>{formatNum(totalVenduKg, 1)} / {formatNum(totalProduction, 1)} kg</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-blue transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct}%</p>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Performance par Bac */}
        <BacPerformanceSection data={bacPerfData} vagueId={vague.id} />

        {/* Chart */}
        <PoidsChart
          data={poidsData}
          gompertzConfidence={hasGompertz ? effectiveGompertz!.confidenceLevel : null}
          gompertzR2={hasGompertz ? effectiveGompertz!.r2 : null}
          gompertzRmse={hasGompertz ? effectiveGompertz!.rmse : null}
          gompertzBiometrieCount={hasGompertz ? effectiveGompertz!.biometrieCount : null}
          gompertzParams={hasGompertz ? effectiveGompertz!.params : null}
          poidsObjectif={poidsObjectif}
          joursActuels={Math.floor((Date.now() - new Date(vague.dateDebut).getTime()) / 86400000)}
          dateDebut={new Date(vague.dateDebut)}
        />

        {/* Coût de production */}
        {permissions.includes(Permission.FINANCES_VOIR) && coutProduction && (
          <CoutProductionCard data={coutProduction} vagueId={id} hasParents={hasIncomingTransferts} />
        )}

        {/* Calibrages */}
        {permissions.includes(Permission.CALIBRAGES_VOIR) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">{t("detail.sections.calibrages")}</h2>
              {isEnCours && permissions.includes(Permission.CALIBRAGES_CREER) && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/vagues/${vague.id}/calibrage/nouveau`}>
                    <Scissors className="h-4 w-4" />
                    {t("detail.sections.nouveau")}
                  </Link>
                </Button>
              )}
            </div>
            <CalibragesList calibrages={calibragesDb as CalibrageWithRelations[]} limit={2} vagueId={vague.id} />
          </section>
        )}

        {/* Bacs — Section ADR-043 (active + retirés + timeline) */}
        {assignationsDb.length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-3">{t("bacsSection.title")}</h2>
            <VagueBacsSection
              vagueId={vague.id}
              bacsActifs={(assignationsDb.filter((a) => a.dateFin === null) as AssignationBacForVague[]).map((a) => ({
                ...a,
                vivants: vivantsByBac.get(a.bacId) ?? a.nombreActuel ?? null,
              }))}
              bacsRetires={assignationsDb.filter((a) => a.dateFin !== null) as AssignationBacForVague[]}
              canDetachEmptyBacs={isEnCours && permissions.includes(Permission.VAGUES_MODIFIER)}
            />
            {assignationsDb.length > 1 && (
              <div className="mt-4">
                <VagueBacsTimeline
                  assignations={assignationsDb as AssignationBacForVague[]}
                  dateDebutVague={vague.dateDebut}
                  dateFinVague={vague.dateFin}
                />
              </div>
            )}
          </section>
        )}

        {/* Relevés */}
        <RelevesList
          releves={relevesPreview.data as unknown as Releve[]}
          produits={produitsDb.map((p) => ({
            id: p.id,
            nom: p.nom,
            categorie: p.categorie,
            unite: p.unite,
            stockActuel: p.stockActuel,
          } satisfies ProduitOption))}
          permissions={permissions}
          limit={2}
          vagueId={vague.id}
        />

        {/* Retour */}
        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/vagues">
              <ArrowLeft className="h-4 w-4" />
              {t("detail.retourVagues")}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[VagueDetailPage]", error);
    throw error;
  }
}

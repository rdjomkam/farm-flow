import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve, StatutActivite } from "@/types";
import type { DashboardData, VagueDashboardSummary, ProjectionVague, CourbeCroissancePoint, IndicateursBenchmarkVague, ConfigElevage } from "@/types";
import {
  calculerTauxSurvie,
  calculerBiomasse,
  calculerSGR,
  calculerFCR,
  calculerTauxMortalite,
  calculerSGRRequis,
  calculerDateRecolteEstimee,
  calculerAlimentRestantEstime,
  calculerRevenuAttendu,
  genererCourbeProjection,
  computeNombreVivantsVague,
  computeVivantsByBac,
} from "@/lib/calculs";
import { getConfigElevageDefaut } from "@/lib/queries/config-elevage";
import { CONFIG_ELEVAGE_DEFAULTS } from "@/lib/queries/config-elevage";
import {
  evaluerBenchmark,
  getBenchmarks,
} from "@/lib/benchmarks";

/**
 * Charge les donnees du dashboard pour un site :
 * - Nombre de vagues actives
 * - Biomasse totale et taux de survie moyen
 * - Bacs occupes / total
 * - Resume par vague active
 */
export async function getDashboardData(siteId: string): Promise<DashboardData> {
  const [vaguesActives, bacsTotal, bacsOccupes] = await Promise.all([
    prisma.vague.findMany({
      where: { siteId, statut: StatutVague.EN_COURS },
      include: {
        _count: { select: { bacs: true } },
        bacs: { select: { id: true, nombreInitial: true } },
        releves: {
          orderBy: { date: "asc" },
          select: {
            typeReleve: true,
            poidsMoyen: true,
            nombreMorts: true,
            nombreCompte: true,
            bacId: true,
          },
        },
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.bac.count({ where: { siteId } }),
    prisma.bac.count({ where: { siteId, vagueId: { not: null } } }),
  ]);

  const vagues: VagueDashboardSummary[] = vaguesActives.map((v) => {
    const biometries = v.releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
    const nombreVivants = computeNombreVivantsVague(v.bacs, v.releves, v.nombreInitial);
    const hasPerBacReleves = v.releves.some((r) => r.bacId !== null);

    const now = new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    const tauxSurvie = calculerTauxSurvie(nombreVivants, v.nombreInitial);

    let poidsMoyen: number | null = null;
    let biomasse: number | null = null;

    if (hasPerBacReleves && v.bacs.length > 0) {
      // Per-bac weighted calculation (same logic as indicateurs.ts)
      const vivantsByBac = computeVivantsByBac(v.bacs, v.releves, v.nombreInitial);
      const biometriesParBac = new Map<string, (typeof biometries)[0]>();
      for (const b of biometries) {
        if (b.bacId) biometriesParBac.set(b.bacId, b);
      }
      let totalBiomasse = 0;
      let hasBiomasse = false;
      let totalPoidsWeighted = 0;
      let totalVivantsForWeight = 0;
      for (const bac of v.bacs) {
        const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
        const bio = biometriesParBac.get(bac.id);
        if (bio && bio.poidsMoyen !== null) {
          totalBiomasse += bio.poidsMoyen * vivantsBac / 1000;
          hasBiomasse = true;
          totalPoidsWeighted += bio.poidsMoyen * vivantsBac;
          totalVivantsForWeight += vivantsBac;
        }
      }
      biomasse = hasBiomasse ? Math.round(totalBiomasse * 100) / 100 : null;
      poidsMoyen = totalVivantsForWeight > 0
        ? Math.round((totalPoidsWeighted / totalVivantsForWeight) * 100) / 100
        : null;
    } else {
      // Fallback: global (no bacId on releves)
      poidsMoyen = biometries.at(-1)?.poidsMoyen ?? null;
      biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
    }

    return {
      id: v.id,
      code: v.code,
      joursEcoules,
      poidsMoyen,
      tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
      biomasse: biomasse !== null ? Math.round(biomasse * 100) / 100 : null,
      nombreBacs: v._count.bacs,
      statut: v.statut as StatutVague,
    };
  });

  const biomasses = vagues.map((v) => v.biomasse).filter((b): b is number => b !== null);
  const survies = vagues.map((v) => v.tauxSurvie).filter((s): s is number => s !== null);

  return {
    vaguesActives: vagues.length,
    biomasseTotale: biomasses.length > 0 ? biomasses.reduce((a, b) => a + b, 0) : null,
    tauxSurvieMoyen:
      survies.length > 0
        ? Math.round((survies.reduce((a, b) => a + b, 0) / survies.length) * 100) / 100
        : null,
    bacsOccupes,
    bacsTotal,
    vagues,
  };
}

/**
 * Calcule les projections de performance pour toutes les vagues actives d'un site.
 *
 * Pour chaque vague :
 * - SGR actuel vs SGR requis
 * - Date de recolte estimee
 * - Aliment restant estime
 * - Revenu attendu (null — prixVenteKg pas dans ConfigElevage v1)
 * - Courbe de croissance projetee (reelle + future) pour Recharts
 *
 * Utilise ConfigElevage.isDefault si disponible, sinon CONFIG_ELEVAGE_DEFAULTS.
 */
export async function getProjectionsDashboard(siteId: string): Promise<ProjectionVague[]> {
  const [vaguesActives, configElevage] = await Promise.all([
    prisma.vague.findMany({
      where: { siteId, statut: StatutVague.EN_COURS },
      include: {
        bacs: { select: { id: true, nombreInitial: true } },
        releves: {
          orderBy: { date: "asc" },
          select: {
            typeReleve: true,
            date: true,
            poidsMoyen: true,
            nombreMorts: true,
            nombreCompte: true,
            quantiteAliment: true,
            bacId: true,
          },
        },
      },
    }),
    getConfigElevageDefaut(siteId),
  ]);

  const config = configElevage ?? CONFIG_ELEVAGE_DEFAULTS;
  const poidsObjectif = config.poidsObjectif;
  // prixVenteKg n'est pas dans ConfigElevage — revenu attendu sera null pour l'instant
  const prixVenteKg: number | null = null;

  const now = new Date();

  return vaguesActives.map((v) => {
    const biometries = v.releves
      .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const alimentations = v.releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);

    const poidsMoyenActuel = biometries.at(-1)?.poidsMoyen ?? null;
    const nombreVivants = computeNombreVivantsVague(v.bacs, v.releves, v.nombreInitial);
    const totalAliment = alimentations.reduce((sum, r) => sum + (r.quantiteAliment ?? 0), 0);

    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    // SGR actuel : entre premier et dernier releve biometrique (ou depuis le debut)
    const premierPoids =
      biometries.length > 0
        ? biometries.at(0)!.poidsMoyen
        : (v.poidsMoyenInitial ?? null);
    const dernierPoids = biometries.at(-1)?.poidsMoyen ?? null;
    const joursEntreReleves =
      biometries.length >= 2
        ? Math.max(
            1,
            Math.floor(
              (biometries.at(-1)!.date.getTime() - biometries.at(0)!.date.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : Math.max(1, joursEcoules);

    const sgrActuel = calculerSGR(premierPoids, dernierPoids, joursEntreReleves);

    // FCR actuel pour estimer l'aliment restant
    const biomasseDebut = calculerBiomasse(premierPoids, v.nombreInitial);
    const biomasseActuelle = calculerBiomasse(poidsMoyenActuel, nombreVivants);
    const gainBiomasse =
      biomasseDebut !== null && biomasseActuelle !== null
        ? biomasseActuelle - biomasseDebut
        : null;
    const fcrActuel = calculerFCR(totalAliment > 0 ? totalAliment : null, gainBiomasse);
    const fcrUtilise = fcrActuel ?? 1.5; // fallback FCR cible silures

    // Jours restants jusqu'a la fin du cycle estime
    const dureeEstimeeCycle = config.dureeEstimeeCycle;
    const joursRestants = Math.max(1, dureeEstimeeCycle - joursEcoules);

    // SGR requis pour atteindre l'objectif dans le temps restant
    const sgrRequis = calculerSGRRequis(poidsMoyenActuel, poidsObjectif, joursRestants);

    // En avance ou dans les temps ?
    const enAvance =
      sgrActuel !== null && sgrRequis !== null ? sgrActuel >= sgrRequis : null;

    // Date de recolte estimee d'apres le SGR actuel
    const dateRecolteEstimee = calculerDateRecolteEstimee(
      poidsMoyenActuel,
      poidsObjectif,
      sgrActuel,
      now
    );
    const joursRestantsEstimes =
      dateRecolteEstimee !== null
        ? Math.max(
            0,
            Math.round(
              (dateRecolteEstimee.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : null;

    // Aliment restant estimé avec FCR actuel ou fallback
    const alimentRestantEstime = calculerAlimentRestantEstime(
      poidsMoyenActuel,
      poidsObjectif,
      nombreVivants,
      fcrUtilise
    );

    // Revenu attendu (null car prixVenteKg non disponible dans ConfigElevage)
    const revenuAttendu = calculerRevenuAttendu(poidsObjectif, nombreVivants, prixVenteKg);

    // Courbe de projection (jusqu'a 90 jours)
    const joursProjection = Math.min(joursRestantsEstimes ?? 60, 90);
    const pointsProjectes = genererCourbeProjection(
      poidsMoyenActuel,
      sgrActuel,
      joursProjection,
      joursEcoules
    );

    // Courbe reelle (points biometriques)
    const pointsReels: CourbeCroissancePoint[] = biometries.map((b) => {
      const jourReleve = Math.floor(
        (b.date.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { jour: jourReleve, poidsReel: b.poidsMoyen, poidsProjecte: null };
    });

    // Fusion : eviter les doublons sur le meme jour
    const joursDejaPresents = new Set(pointsReels.map((p) => p.jour));
    const pointsProjectesFiltres: CourbeCroissancePoint[] = pointsProjectes
      .filter((p) => !joursDejaPresents.has(p.jour))
      .map((p) => ({
        jour: p.jour,
        poidsReel: null,
        poidsProjecte: p.poidsProjecte,
      }));

    // Point de jonction au jour courant (visible sur les deux series)
    const jonction: CourbeCroissancePoint[] =
      poidsMoyenActuel !== null
        ? [{ jour: joursEcoules, poidsReel: poidsMoyenActuel, poidsProjecte: poidsMoyenActuel }]
        : [];

    const courbeProjection: CourbeCroissancePoint[] = [
      ...pointsReels.filter((p) => p.jour < joursEcoules),
      ...jonction,
      ...pointsProjectesFiltres,
    ].sort((a, b) => a.jour - b.jour);

    return {
      vagueId: v.id,
      vagueCode: v.code,
      sgrActuel: sgrActuel !== null ? Math.round(sgrActuel * 100) / 100 : null,
      sgrRequis: sgrRequis !== null ? Math.round(sgrRequis * 100) / 100 : null,
      enAvance,
      dateRecolteEstimee,
      joursRestantsEstimes,
      alimentRestantEstime:
        alimentRestantEstime !== null ? Math.round(alimentRestantEstime * 10) / 10 : null,
      revenuAttendu: revenuAttendu !== null ? Math.round(revenuAttendu) : null,
      courbeProjection,
      poidsMoyenActuel,
      poidsObjectif,
      joursEcoules,
    };
  });
}

/**
 * Charge les derniers releves pour le fil d'activite recente du dashboard.
 */
export async function getRecentActivity(siteId: string, limit = 5) {
  return prisma.releve.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      vague: { select: { code: true } },
      bac: { select: { nom: true } },
    },
  });
}

/**
 * Calcule les indicateurs de performance avec niveaux de benchmark pour toutes les vagues actives.
 * Utilisé par le panel de benchmarks du dashboard.
 *
 * Pour chaque vague active, calcule FCR, SGR, survie, mortalite, densite
 * et evalue le niveau de benchmark (EXCELLENT/BON/ACCEPTABLE/MAUVAIS).
 *
 * @param siteId - ID du site (R8)
 */
export async function getDashboardIndicateurs(
  siteId: string
): Promise<IndicateursBenchmarkVague[]> {
  // Charger les vagues actives et la config en parallele (independants)
  const [vagues, configRaw] = await Promise.all([
    prisma.vague.findMany({
      where: { siteId, statut: StatutVague.EN_COURS },
      include: {
        bacs: {
          select: { id: true, volume: true, nombreInitial: true },
        },
        releves: {
          orderBy: { date: "asc" },
          select: {
            typeReleve: true,
            date: true,
            poidsMoyen: true,
            nombreMorts: true,
            quantiteAliment: true,
            nombreCompte: true,
            bacId: true,
          },
        },
      },
      orderBy: { dateDebut: "desc" },
    }),
    getConfigElevageDefaut(siteId),
  ]);

  // Cast necessaire car le type Prisma (JsonValue sur alimentTailleConfig) differe
  // de l'interface ConfigElevage — seuls les champs numeriques scalaires sont utilises.
  const benchmarks = getBenchmarks(configRaw as unknown as ConfigElevage | null);

  // Charger TOUTES les activites correctives en une seule requete (anti N+1)
  const vagueIds = vagues.map((v) => v.id);
  const activitesCorrectives = await prisma.activite.findMany({
    where: {
      siteId,
      vagueId: { in: vagueIds },
      statut: { not: StatutActivite.TERMINEE },
    },
    orderBy: { dateDebut: "asc" },
    select: { id: true, titre: true, vagueId: true },
  });

  // Indexer par vagueId pour un acces O(1) dans la boucle
  const activiteByVagueId = new Map<string, { id: string; titre: string }>();
  for (const a of activitesCorrectives) {
    if (a.vagueId && !activiteByVagueId.has(a.vagueId)) {
      activiteByVagueId.set(a.vagueId, { id: a.id, titre: a.titre });
    }
  }

  const resultats: IndicateursBenchmarkVague[] = [];

  for (const v of vagues) {
    const biometries = v.releves.filter((r) => r.typeReleve === TypeReleve.BIOMETRIE);
    const mortalites = v.releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
    const alimentations = v.releves.filter((r) => r.typeReleve === TypeReleve.ALIMENTATION);
    const comptages = v.releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

    const poidsMoyen = biometries.at(-1)?.poidsMoyen ?? null;
    const totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    const totalAliment = alimentations.reduce((sum, r) => sum + (r.quantiteAliment ?? 0), 0);
    const nombreVivants = computeNombreVivantsVague(v.bacs, v.releves, v.nombreInitial);

    const now = v.dateFin ?? new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    const tauxSurvie = calculerTauxSurvie(nombreVivants, v.nombreInitial);
    const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);
    const biomasseInitiale = calculerBiomasse(v.poidsMoyenInitial, v.nombreInitial);
    const gainBiomasse =
      biomasse !== null && biomasseInitiale !== null ? biomasse - biomasseInitiale : null;
    const fcr = calculerFCR(totalAliment > 0 ? totalAliment : null, gainBiomasse);
    const sgr = calculerSGR(v.poidsMoyenInitial, poidsMoyen, joursEcoules);
    const tauxMortalite = calculerTauxMortalite(totalMortalites, v.nombreInitial);

    // Densite : poissons / m3 en utilisant le volume total des bacs
    const volumeTotalLitres = v.bacs.reduce((sum, b) => sum + (b.volume ?? 0), 0);
    const volumeTotalM3 = volumeTotalLitres > 0 ? volumeTotalLitres / 1000 : null;
    const densite =
      nombreVivants !== null && volumeTotalM3 !== null && volumeTotalM3 > 0
        ? nombreVivants / volumeTotalM3
        : null;

    // Evaluer les niveaux de benchmark
    const niveauSurvie = evaluerBenchmark(tauxSurvie, benchmarks.survie);
    const niveauFcr = evaluerBenchmark(fcr, benchmarks.fcr);
    const niveauSgr = evaluerBenchmark(sgr, benchmarks.sgr);
    const niveauMortalite = evaluerBenchmark(tauxMortalite, benchmarks.mortalite);
    const niveauDensite = evaluerBenchmark(densite, benchmarks.densite);

    // Determiner si au moins un indicateur est MAUVAIS
    const aMauvaisIndicateur =
      niveauSurvie === "MAUVAIS" ||
      niveauFcr === "MAUVAIS" ||
      niveauSgr === "MAUVAIS" ||
      niveauMortalite === "MAUVAIS" ||
      niveauDensite === "MAUVAIS";

    // Chercher l'activite corrective la plus recente si indicateur MAUVAIS
    // Les activites ont deja ete chargees en une seule requete avant la boucle (anti N+1)
    let activiteCorrectiveId: string | null = null;
    let activiteCorrectiveTitre: string | null = null;

    if (aMauvaisIndicateur) {
      const activite = activiteByVagueId.get(v.id) ?? null;
      if (activite) {
        activiteCorrectiveId = activite.id;
        activiteCorrectiveTitre = activite.titre;
      }
    }

    resultats.push({
      vagueId: v.id,
      vagueCode: v.code,
      tauxSurvie: tauxSurvie !== null ? Math.round(tauxSurvie * 100) / 100 : null,
      fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
      sgr: sgr !== null ? Math.round(sgr * 100) / 100 : null,
      tauxMortalite: tauxMortalite !== null ? Math.round(tauxMortalite * 100) / 100 : null,
      densite: densite !== null ? Math.round(densite * 10) / 10 : null,
      nombreVivants,
      activiteCorrectiveId,
      activiteCorrectiveTitre,
    });
  }

  return resultats;
}

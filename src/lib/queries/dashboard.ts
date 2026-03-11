import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve } from "@/types";
import type { DashboardData, VagueDashboardSummary } from "@/types";
import { calculerTauxSurvie, calculerBiomasse } from "@/lib/calculs";

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
        releves: {
          orderBy: { date: "asc" },
          select: {
            typeReleve: true,
            poidsMoyen: true,
            nombreMorts: true,
            nombreCompte: true,
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
    const mortalites = v.releves.filter((r) => r.typeReleve === TypeReleve.MORTALITE);
    const comptages = v.releves.filter((r) => r.typeReleve === TypeReleve.COMPTAGE);

    const poidsMoyen = biometries.at(-1)?.poidsMoyen ?? null;
    const totalMortalites = mortalites.reduce((sum, r) => sum + (r.nombreMorts ?? 0), 0);
    const nombreVivants = comptages.at(-1)?.nombreCompte ?? v.nombreInitial - totalMortalites;

    const now = new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    const tauxSurvie = calculerTauxSurvie(nombreVivants, v.nombreInitial);
    const biomasse = calculerBiomasse(poidsMoyen, nombreVivants);

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

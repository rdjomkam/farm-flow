/**
 * Alertes specifiques au module Reproduction (R3-S13).
 *
 * INCUBATION_ECLOSION : alerte quand une incubation approche de sa date d'eclosion prevue
 *   - Fenetre : 2h avant dateEclosionPrevue
 *   - Deduplication : une seule alerte ACTIVE par incubation par jour
 *   - Lien : /reproduction/incubations/[id]
 *
 * TAUX_SURVIE_CRITIQUE_LOT : alerte quand le taux de survie d'un lot d'alevins
 *   passe sous le seuil configure (seuilPourcentage) ou 70% par defaut.
 *   - Formule : (nombreActuel / nombreInitial) * 100
 *   - Deduplication : une seule alerte ACTIVE par lot par jour
 *   - Lien : /reproduction/lots/[id]
 */

import { prisma } from "@/lib/db";
import { TypeAlerte, StatutAlerte, StatutIncubation, StatutLotAlevins } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Verifie si une notification ACTIVE du meme type existe deja aujourd'hui
 * pour une entite specifique (identifiee par son lien).
 * Utilise le champ lien pour distinguer les notifications par entite.
 */
async function notificationActiveExistePourLien(
  siteId: string,
  userId: string,
  typeAlerte: TypeAlerte,
  lien: string
): Promise<boolean> {
  const now = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const finJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const count = await prisma.notification.count({
    where: {
      siteId,
      userId,
      typeAlerte,
      lien,
      statut: StatutAlerte.ACTIVE,
      createdAt: { gte: debutJour, lte: finJour },
    },
  });

  return count > 0;
}

// ---------------------------------------------------------------------------
// INCUBATION_ECLOSION
// ---------------------------------------------------------------------------

/**
 * Verifie les incubations dont la date d'eclosion prevue approche (dans moins de 2h)
 * et cree une alerte INCUBATION_ECLOSION pour chaque administrateur/gerant du site.
 *
 * Conditions :
 * - statut = EN_COURS ou ECLOSION_EN_COURS
 * - dateEclosionPrevue non nulle
 * - dateEclosionPrevue dans [maintenant, maintenant + 2h]
 *
 * @param siteId - ID du site a verifier (R8)
 */
export async function checkIncubationEclosionAlerts(siteId: string): Promise<void> {
  const maintenant = new Date();
  const dans2h = new Date(maintenant.getTime() + 2 * 60 * 60 * 1000);

  const incubationsProches = await prisma.incubation.findMany({
    where: {
      siteId,
      statut: {
        in: [StatutIncubation.EN_COURS, StatutIncubation.ECLOSION_EN_COURS],
      },
      dateEclosionPrevue: {
        gte: maintenant,
        lte: dans2h,
      },
    },
    select: {
      id: true,
      code: true,
      dateEclosionPrevue: true,
      ponte: {
        select: { code: true },
      },
    },
  });

  if (incubationsProches.length === 0) return;

  // Recuperer les membres du site pour creer les notifications
  const membres = await prisma.siteMember.findMany({
    where: { siteId },
    select: { userId: true },
  });

  for (const incubation of incubationsProches) {
    const lien = `/reproduction/incubations/${incubation.id}`;
    const dateEclosion = incubation.dateEclosionPrevue!;
    const heuresRestantes = Math.round(
      (dateEclosion.getTime() - maintenant.getTime()) / (60 * 60 * 1000)
    );
    const minutesRestantes = Math.round(
      (dateEclosion.getTime() - maintenant.getTime()) / (60 * 1000)
    );
    const tempsFormate =
      heuresRestantes >= 1
        ? `dans ${heuresRestantes}h`
        : `dans ${minutesRestantes} min`;

    const titre = `Eclosion imminente : ${incubation.code}`;
    const message =
      `L'incubation ${incubation.code}${incubation.ponte ? ` (ponte ${incubation.ponte.code})` : ""} ` +
      `arrive a eclosion ${tempsFormate}. Preparez le bac de reception des larves.`;

    for (const membre of membres) {
      const existeDeja = await notificationActiveExistePourLien(
        siteId,
        membre.userId,
        TypeAlerte.INCUBATION_ECLOSION,
        lien
      );
      if (!existeDeja) {
        await prisma.notification.create({
          data: {
            typeAlerte: TypeAlerte.INCUBATION_ECLOSION,
            titre,
            message,
            statut: StatutAlerte.ACTIVE,
            lien,
            userId: membre.userId,
            siteId,
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TAUX_SURVIE_CRITIQUE_LOT
// ---------------------------------------------------------------------------

/**
 * Verifie les lots d'alevins dont le taux de survie est inferieur au seuil critique.
 *
 * Formule : taux = (nombreActuel / nombreInitial) * 100
 * Seuil par defaut : 70% si aucune config n'est trouvee.
 *
 * Conditions de declenchement :
 * - statut = EN_ELEVAGE (les lots EN_INCUBATION ou TRANSFERE/PERDU sont exclus)
 * - nombreInitial > 0
 * - taux < seuil
 *
 * @param siteId - ID du site a verifier (R8)
 */
export async function checkLotSurvieAlerts(siteId: string): Promise<void> {
  // Recuperer la config TAUX_SURVIE_CRITIQUE_LOT si elle existe
  const configsAlerte = await prisma.configAlerte.findMany({
    where: {
      siteId,
      typeAlerte: TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT,
      enabled: true,
    },
    select: {
      userId: true,
      seuilPourcentage: true,
      seuilValeur: true,
    },
  });

  // Seuil par defaut = 70%
  const seuilDefaut = 70;

  const lotsEnElevage = await prisma.lotAlevins.findMany({
    where: {
      siteId,
      statut: StatutLotAlevins.EN_ELEVAGE,
      nombreInitial: { gt: 0 },
    },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      nombreActuel: true,
      ponte: {
        select: { code: true },
      },
    },
  });

  if (lotsEnElevage.length === 0) return;

  for (const lot of lotsEnElevage) {
    const tauxSurvie = (lot.nombreActuel / lot.nombreInitial) * 100;
    const lien = `/reproduction/lots/${lot.id}`;

    if (configsAlerte.length > 0) {
      // Verifier pour chaque utilisateur ayant configure l'alerte
      for (const config of configsAlerte) {
        const seuil = config.seuilPourcentage ?? config.seuilValeur ?? seuilDefaut;
        if (tauxSurvie < seuil) {
          const existeDeja = await notificationActiveExistePourLien(
            siteId,
            config.userId,
            TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT,
            lien
          );
          if (!existeDeja) {
            await prisma.notification.create({
              data: {
                typeAlerte: TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT,
                titre: `Taux de survie critique : ${lot.code}`,
                message:
                  `Le lot ${lot.code}${lot.ponte ? ` (ponte ${lot.ponte.code})` : ""} ` +
                  `a un taux de survie de ${tauxSurvie.toFixed(1)}% ` +
                  `(${lot.nombreActuel}/${lot.nombreInitial}), ` +
                  `sous le seuil critique de ${seuil}%.`,
                statut: StatutAlerte.ACTIVE,
                lien,
                userId: config.userId,
                siteId,
              },
            });
          }
        }
      }
    } else {
      // Pas de config : utiliser le seuil par defaut, notifier tous les membres
      if (tauxSurvie < seuilDefaut) {
        const membres = await prisma.siteMember.findMany({
          where: { siteId },
          select: { userId: true },
        });

        for (const membre of membres) {
          const existeDeja = await notificationActiveExistePourLien(
            siteId,
            membre.userId,
            TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT,
            lien
          );
          if (!existeDeja) {
            await prisma.notification.create({
              data: {
                typeAlerte: TypeAlerte.TAUX_SURVIE_CRITIQUE_LOT,
                titre: `Taux de survie critique : ${lot.code}`,
                message:
                  `Le lot ${lot.code}${lot.ponte ? ` (ponte ${lot.ponte.code})` : ""} ` +
                  `a un taux de survie de ${tauxSurvie.toFixed(1)}% ` +
                  `(${lot.nombreActuel}/${lot.nombreInitial}), ` +
                  `sous le seuil critique de ${seuilDefaut}%.`,
                statut: StatutAlerte.ACTIVE,
                lien,
                userId: membre.userId,
                siteId,
              },
            });
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fonction principale — verifier toutes les alertes reproduction
// ---------------------------------------------------------------------------

/**
 * Verifie toutes les alertes du module Reproduction pour un site donne.
 * Appelle checkIncubationEclosionAlerts et checkLotSurvieAlerts.
 *
 * Peut etre appelee depuis un endpoint cron ou depuis les hooks post-action.
 *
 * @param siteId - ID du site (R8)
 */
export async function verifierAlertesReproduction(siteId: string): Promise<void> {
  await Promise.allSettled([
    checkIncubationEclosionAlerts(siteId),
    checkLotSurvieAlerts(siteId),
  ]);
}

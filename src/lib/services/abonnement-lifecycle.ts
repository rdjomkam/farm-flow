/**
 * src/lib/services/abonnement-lifecycle.ts
 *
 * Service de gestion du cycle de vie des abonnements.
 * Utilisé par le CRON job quotidien pour les transitions automatiques de statut.
 *
 * ADR-017 : Cycle de vie ACTIF → EN_GRACE → SUSPENDU → EXPIRE
 * Story 31.4 — Sprint 31
 * Sprint 36 : CRON job principal + rappels email/SMS
 * Sprint 50 : appliquerDowngradeProgramme — CRON Story 50.5
 *
 * R4 : Toutes les transitions via updateMany avec condition (atomique)
 */

import { prisma } from "@/lib/db";
import {
  getAbonnementsEnGraceExpires,
  getEssaisExpires,
  expirerEssai,
} from "@/lib/queries/abonnements";
import { StatutAbonnement, PeriodeFacturation, TypePlan } from "@/types";
import { TypeAlerte } from "@/generated/prisma/enums";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { GRACE_PERIOD_JOURS, SUSPENSION_JOURS, PLAN_LIMITES, calculerProchaineDate } from "@/lib/abonnements-constants";
import { creerNotificationSiAbsente } from "@/lib/alertes";
import type { DowngradeRessourcesAGarder } from "@/types";

// ---------------------------------------------------------------------------
// Types de résultat
// ---------------------------------------------------------------------------

export interface TransitionStatutsResult {
  /** Abonnements passés ACTIF → EN_GRACE (expirés sans grâce) */
  graces: number;
  /** Abonnements passés EN_GRACE → SUSPENDU */
  suspendus: number;
  /** Abonnements passés SUSPENDU → EXPIRE */
  expires: number;
  /** Essais passés ACTIF → EXPIRE directement (sans période de grâce) */
  essaisExpires: number;
}

// ---------------------------------------------------------------------------
// transitionnerStatuts — Exécuté par le CRON job quotidien
// ---------------------------------------------------------------------------

/**
 * Applique toutes les transitions automatiques de statut.
 * Appelé quotidiennement (00:00 UTC selon ADR-017).
 *
 * Ordre des transitions :
 * 0. ESSAI ACTIF → EXPIRE directement (dateFin < maintenant, isEssai=true) — pas de période de grâce
 * 1. ACTIF → EN_GRACE (dateFin < maintenant, isEssai=false)
 * 2. EN_GRACE → SUSPENDU (dateFinGrace < maintenant)
 * 3. SUSPENDU → EXPIRE (dateFin + GRACE_PERIOD + SUSPENSION < maintenant)
 *
 * @returns Nombre d'abonnements affectés par type de transition
 */
export async function transitionnerStatuts(): Promise<TransitionStatutsResult> {
  const maintenant = new Date();

  // Transition 0 : ESSAI ACTIF → EXPIRE (sans période de grâce — RISQUE-2 résolu)
  // Les essais expirés ne passent pas par EN_GRACE : transition directe ACTIF → EXPIRE.
  const essaisExpiresListe = await getEssaisExpires();
  let essaisExpires = 0;

  for (const essai of essaisExpiresListe) {
    const result = await expirerEssai(essai.id);
    if (result.count > 0) {
      essaisExpires++;
      // Envoyer notification de fin d'essai (idempotente via creerNotificationSiAbsente)
      try {
        const nomPlan = (essai.plan as { nom: string } | null)?.nom ?? "votre plan";
        await creerNotificationSiAbsente(
          essai.siteId,
          essai.userId,
          TypeAlerte.ABONNEMENT_ESSAI_EXPIRE,
          "Votre essai gratuit est termine",
          `Votre essai gratuit du plan ${nomPlan} est termine. Souscrivez maintenant pour continuer a beneficier de toutes les fonctionnalites.`,
          "/abonnement"
        );
      } catch (err) {
        console.error(
          `[abonnement-lifecycle] Echec notification fin essai pour abonnement ${essai.id}:`,
          err
        );
        // On continue : les autres essais ne doivent pas etre bloques
      }
    }
  }

  // Transition 1 : ACTIF → EN_GRACE
  // Abonnements dont la dateFin est dépassée et pas encore en grâce
  // Exclure les essais (isEssai=false) — ils sont gérés dans la Transition 0
  const dateFinGrace = new Date(maintenant);
  dateFinGrace.setDate(dateFinGrace.getDate() + GRACE_PERIOD_JOURS);

  // R2 : utiliser StatutAbonnement.ACTIF depuis "@/types"
  const { count: graces } = await prisma.abonnement.updateMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      isEssai: false,
      dateFin: { lt: maintenant },
    },
    data: {
      statut: StatutAbonnement.EN_GRACE,
      dateFinGrace,
    },
  });

  // Transition 2 : EN_GRACE → SUSPENDU
  // Abonnements dont la période de grâce est expirée
  // R4 : Envelopper dans prisma.$transaction() pour garantir l'atomicité
  // complète — un crash en milieu de boucle ne laisse plus d'état partiel.
  const abonnementsEnGraceExpires = await getAbonnementsEnGraceExpires();
  let suspendus = 0;

  if (abonnementsEnGraceExpires.length > 0) {
    const counts = await prisma.$transaction(
      abonnementsEnGraceExpires.map((abo) =>
        prisma.abonnement.updateMany({
          where: {
            id: abo.id,
            statut: StatutAbonnement.EN_GRACE,
            dateFinGrace: { lt: maintenant },
          },
          data: { statut: StatutAbonnement.SUSPENDU },
        })
      )
    );
    suspendus = counts.reduce((acc, result) => acc + result.count, 0);
  }

  // Transition 3 : SUSPENDU → EXPIRE
  // Abonnements suspendus depuis plus de SUSPENSION_JOURS
  // = dateFin + GRACE_PERIOD_JOURS + SUSPENSION_JOURS < maintenant
  const limiteSuspension = new Date(maintenant);
  limiteSuspension.setDate(
    limiteSuspension.getDate() - (GRACE_PERIOD_JOURS + SUSPENSION_JOURS)
  );

  const { count: expires } = await prisma.abonnement.updateMany({
    where: {
      statut: StatutAbonnement.SUSPENDU,
      dateFin: { lt: limiteSuspension },
    },
    data: { statut: StatutAbonnement.EXPIRE },
  });

  return { graces, suspendus, expires, essaisExpires };
}

// ---------------------------------------------------------------------------
// getAbonnementsExpirantProchainement — Pour les rappels (Sprint 36)
// ---------------------------------------------------------------------------

/**
 * Retourne les abonnements ACTIF qui expirent dans X jours.
 * Utilisé par le CRON job de rappels (J-14, J-7, J-3, J-1).
 *
 * @param joursAvant - Nombre de jours avant expiration (ex: 7)
 */
export async function getAbonnementsExpirantDans(joursAvant: number) {
  const maintenant = new Date();
  const limite = new Date(maintenant);
  limite.setDate(limite.getDate() + joursAvant);

  return prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      dateFin: {
        gte: maintenant,
        lt: limite,
      },
    },
    include: {
      plan: { select: { nom: true, typePlan: true } },
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// appliquerDowngradeProgramme — CRON Story 50.5
// ---------------------------------------------------------------------------

/**
 * Résultat de l'application des downgrades programmés.
 */
export interface AppliquerDowngradeResult {
  /** Nombre de downgrades appliqués avec succès */
  appliques: number;
  /** Nombre de downgrades ignorés (plan introuvable, inactif, ou erreur) */
  ignores: number;
  /** Détail des downgrades appliqués */
  details: Array<{
    abonnementId: string;
    siteId: string;
    ancienPlanId: string;
    nouveauPlanId: string;
    bacsBlockes: number;
    vaguesBloquees: number;
  }>;
}

/**
 * Applique les downgrades programmés arrivant à échéance.
 *
 * Exécuté par le CRON job quotidien.
 * Pour chaque abonnement ACTIF avec downgradeVersId et dateProchainRenouvellement <= maintenant :
 *
 * 1. Re-valide les ressourcesAGarder (IDs pourraient avoir été supprimés)
 * 2. Bloque les ressources hors sélection (isBlocked=true)
 * 3. Crée le nouvel abonnement (nouveau plan, statut ACTIF)
 * 4. Annule l'ancien abonnement, efface les champs downgrade
 *
 * R4 : chaque downgrade est dans sa propre $transaction
 */
export async function appliquerDowngradeProgramme(): Promise<AppliquerDowngradeResult> {
  const maintenant = new Date();

  // Charger les abonnements avec downgrade programmé arrivant à échéance
  const abonnementsAvecDowngrade = await prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      downgradeVersId: { not: null },
      dateProchainRenouvellement: { lte: maintenant },
    },
    select: {
      id: true,
      siteId: true,
      planId: true,
      userId: true,
      periode: true,
      downgradeVersId: true,
      downgradePeriode: true,
      downgradeRessourcesAGarder: true,
    },
  });

  let appliques = 0;
  let ignores = 0;
  const details: AppliquerDowngradeResult["details"] = [];

  for (const abonnement of abonnementsAvecDowngrade) {
    try {
      const detail = await _appliquerUnDowngrade(abonnement, maintenant);
      if (detail) {
        appliques++;
        details.push(detail);
      } else {
        ignores++;
      }
    } catch (err) {
      console.error(
        `[appliquerDowngradeProgramme] Erreur sur abonnement ${abonnement.id}:`,
        err
      );
      ignores++;
    }
  }

  return { appliques, ignores, details };
}

/**
 * Applique le downgrade pour un seul abonnement dans une $transaction.
 * Retourne null si le downgrade ne peut pas être appliqué (plan invalide, etc.).
 */
async function _appliquerUnDowngrade(
  abonnement: {
    id: string;
    siteId: string;
    planId: string;
    userId: string;
    periode: string;
    downgradeVersId: string | null;
    downgradePeriode: string | null;
    downgradeRessourcesAGarder: unknown;
  },
  maintenant: Date
): Promise<AppliquerDowngradeResult["details"][number] | null> {
  if (!abonnement.downgradeVersId) return null;

  // Charger le nouveau plan cible
  const nouveauPlan = await prisma.planAbonnement.findUnique({
    where: { id: abonnement.downgradeVersId },
  });

  if (!nouveauPlan || !nouveauPlan.isActif) {
    console.warn(
      `[appliquerDowngradeProgramme] Plan ${abonnement.downgradeVersId} introuvable ou inactif — downgrade ignoré pour abonnement ${abonnement.id}`
    );
    return null;
  }

  // R2/ERR-031 : accès via TypePlan cast
  const limitesNouveauPlan = PLAN_LIMITES[nouveauPlan.typePlan as TypePlan];
  if (!limitesNouveauPlan) {
    console.warn(
      `[appliquerDowngradeProgramme] Limites introuvables pour typePlan ${nouveauPlan.typePlan} — downgrade ignoré`
    );
    return null;
  }

  // Parser les ressources à garder depuis le champ Json
  const ressourcesRaw = abonnement.downgradeRessourcesAGarder as Record<string, unknown> | null;
  const ressourcesAGarder: DowngradeRessourcesAGarder = {
    sites: Array.isArray(ressourcesRaw?.sites)
      ? (ressourcesRaw!.sites as string[])
      : [],
    bacs: typeof ressourcesRaw?.bacs === "object" && ressourcesRaw?.bacs !== null
      ? (ressourcesRaw!.bacs as Record<string, string[]>)
      : {},
    vagues: typeof ressourcesRaw?.vagues === "object" && ressourcesRaw?.vagues !== null
      ? (ressourcesRaw!.vagues as Record<string, string[]>)
      : {},
  };

  const nouvelleperiode = (abonnement.downgradePeriode ?? abonnement.periode) as PeriodeFacturation;

  // Re-valider les IDs des ressources (des ressources peuvent avoir été supprimées entre-temps)
  const [bacsExistants, vaguesExistantes] = await Promise.all([
    prisma.bac.findMany({
      where: { siteId: abonnement.siteId },
      select: { id: true },
    }),
    prisma.vague.findMany({
      where: { siteId: abonnement.siteId },
      select: { id: true },
    }),
  ]);

  const bacsExistantsIds = new Set(bacsExistants.map((b) => b.id));
  const vaguesExistantesIds = new Set(vaguesExistantes.map((v) => v.id));

  // Filtrer : garder uniquement les IDs valides (ressource existante) et respecter les limites
  const bacsAGarderValides = Object.values(ressourcesAGarder.bacs)
    .flat()
    .filter((id) => bacsExistantsIds.has(id))
    .slice(0, limitesNouveauPlan.limitesBacs);

  const vaguesAGarderValides = Object.values(ressourcesAGarder.vagues)
    .flat()
    .filter((id) => vaguesExistantesIds.has(id))
    .slice(0, limitesNouveauPlan.limitesVagues);

  // IDs à bloquer = ceux qui existent mais ne sont PAS dans la sélection valide
  const bacsABlocker = bacsExistants
    .map((b) => b.id)
    .filter((id) => !bacsAGarderValides.includes(id));

  const vaguesABloquer = vaguesExistantes
    .map((v) => v.id)
    .filter((id) => !vaguesAGarderValides.includes(id));

  // R4 : toutes les opérations dans une seule $transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Bloquer les ressources en excès
    const [bacsBlockesResult, vaguesBloquéesResult] = await Promise.all([
      bacsABlocker.length > 0
        ? tx.bac.updateMany({
            where: { id: { in: bacsABlocker }, siteId: abonnement.siteId },
            data: { isBlocked: true },
          })
        : Promise.resolve({ count: 0 }),
      vaguesABloquer.length > 0
        ? tx.vague.updateMany({
            where: { id: { in: vaguesABloquer }, siteId: abonnement.siteId },
            data: { isBlocked: true },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    // 2. Créer le nouvel abonnement (statut ACTIF dès création)
    const dateFinNew = calculerProchaineDate(new Date(maintenant), nouvelleperiode);
    const nouvelAbonnement = await tx.abonnement.create({
      data: {
        siteId: abonnement.siteId,
        planId: nouveauPlan.id,
        periode: nouvelleperiode,
        statut: StatutAbonnement.ACTIF,
        dateDebut: new Date(maintenant),
        dateFin: dateFinNew,
        dateProchainRenouvellement: dateFinNew,
        prixPaye: 0, // Montant payé géré au prochain cycle complet
        userId: abonnement.userId,
      },
    });

    // 3. Annuler l'ancien abonnement et effacer les champs downgrade (R4 — atomique)
    await tx.abonnement.updateMany({
      where: {
        id: abonnement.id,
        statut: StatutAbonnement.ACTIF,
        downgradeVersId: abonnement.downgradeVersId,
      },
      data: {
        statut: StatutAbonnement.ANNULE,
        downgradeVersId: null,
        downgradePeriode: null,
        downgradeRessourcesAGarder: PrismaNamespace.DbNull,
      },
    });

    return {
      nouvelAbonnement,
      bacsBlockes: bacsBlockesResult.count,
      vaguesBloquees: vaguesBloquéesResult.count,
    };
  });

  return {
    abonnementId: result.nouvelAbonnement.id,
    siteId: abonnement.siteId,
    ancienPlanId: abonnement.planId,
    nouveauPlanId: nouveauPlan.id,
    bacsBlockes: result.bacsBlockes,
    vaguesBloquees: result.vaguesBloquees,
  };
}

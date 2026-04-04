/**
 * src/lib/services/rappels-abonnement.ts
 *
 * Service de rappels de renouvellement d'abonnement.
 * Envoie des notifications aux utilisateurs dont l'abonnement expire
 * dans 14, 7, 3 ou 1 jour(s).
 *
 * Regles :
 * - Uniquement les plans payants (exclut TypePlan.DECOUVERTE)
 * - Uniquement les abonnements ACTIF dont dateFin >= maintenant
 * - Deduplication via creerNotificationSiAbsente (une seule notification par type par jour)
 * - Seuils declencheurs : IN [14, 7, 3, 1]
 *
 * Sprint 52 : siteId supprimé d'Abonnement — résolution via userId → site.ownerId (Decision 1)
 *
 * R1 : enums MAJUSCULES
 * R2 : importer les enums depuis "@/types" (sauf TypeAlerte Prisma pour creerNotificationSiAbsente)
 * R4 : creerNotificationSiAbsente est atomique — pas de check-then-update sequentiel
 * Sprint 36.2
 */

import { prisma } from "@/lib/db";
import { TypeAlerte } from "@/generated/prisma/enums";
import { TypePlan, StatutAbonnement } from "@/types";
import { creerNotificationSiAbsente } from "@/lib/alertes";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Seuils (en jours) qui déclenchent un rappel de renouvellement */
const SEUILS_RAPPEL_JOURS = [14, 7, 3, 1] as const;

// ---------------------------------------------------------------------------
// Résultat
// ---------------------------------------------------------------------------

export interface RappelsRenouvellementResult {
  /** Nombre de notifications créées (doublons exclus) */
  envoyes: number;
}

// ---------------------------------------------------------------------------
// Helper : calculer le nombre de jours restants (arrondi à la journée)
// ---------------------------------------------------------------------------

function calculerJoursRestants(dateFin: Date): number {
  const maintenant = new Date();
  // Arrondi à minuit pour comparer des journées entières
  const debutJourCourant = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
    0,
    0,
    0
  );
  const debutJourFin = new Date(
    dateFin.getFullYear(),
    dateFin.getMonth(),
    dateFin.getDate(),
    0,
    0,
    0
  );
  const diffMs = debutJourFin.getTime() - debutJourCourant.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Envoie les rappels de renouvellement pour les abonnements expirant
 * dans 14, 7, 3 ou 1 jour(s).
 *
 * Appelée par le CRON job subscription-lifecycle (Story 36.2).
 *
 * @returns Nombre de notifications effectivement créées (doublons exclus)
 */
export async function envoyerRappelsRenouvellement(): Promise<RappelsRenouvellementResult> {
  const maintenant = new Date();

  // Borne supérieure : dans 14 jours (seuil maximum)
  const dans14Jours = new Date(maintenant);
  dans14Jours.setDate(dans14Jours.getDate() + SEUILS_RAPPEL_JOURS[0]);

  // Une seule requête DB : abonnements ACTIF expirant dans [maintenant, J+14]
  // dateFin >= maintenant : exclut les déjà expirés
  // dateFin <= dans14Jours : exclut ceux hors fenêtre de rappel
  const abonnements = await prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      dateFin: {
        gte: maintenant,
        lte: dans14Jours,
      },
    },
    include: {
      plan: { select: { nom: true, typePlan: true } },
    },
  });

  let envoyes = 0;

  for (const abonnement of abonnements) {
    // R2 : utiliser TypePlan.DECOUVERTE — exclure les plans gratuits
    // ERR-008 : cast via (... as string) pour comparer enum Prisma vs @/types
    if ((abonnement.plan.typePlan as string) === TypePlan.DECOUVERTE) {
      continue;
    }

    const daysRemaining = calculerJoursRestants(abonnement.dateFin);

    // Ne déclencher que pour les seuils exacts : 14, 7, 3, 1
    if (!(SEUILS_RAPPEL_JOURS as readonly number[]).includes(daysRemaining)) {
      continue;
    }

    const jourTexte = daysRemaining === 1 ? "1 jour" : `${daysRemaining} jours`;
    const titre = `Renouvellement dans ${jourTexte}`;
    const message = `Votre abonnement ${abonnement.plan.nom} expire dans ${jourTexte}. Renouvelez maintenant pour eviter l'interruption de service.`;

    // Sprint 52 (Decision 1) : siteId n'est plus sur Abonnement.
    // Résoudre le siteId via le premier site actif appartenant à l'utilisateur.
    // Si aucun site trouvé : passer (edge case — utilisateur sans site).
    let siteId: string | null = null;
    try {
      const site = await prisma.site.findFirst({
        where: { ownerId: abonnement.userId },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      siteId = site?.id ?? null;
    } catch {
      // Erreur lors de la résolution du site — on passe
    }

    if (!siteId) {
      console.warn(
        `[rappels-abonnement] Aucun site trouvé pour userId=${abonnement.userId} — notification ignorée`
      );
      continue;
    }

    // Exception R4 justifiée : pas de $transaction car chaque appel est
    // idempotent — creerNotificationSiAbsente effectue elle-même une
    // déduplication atomique (count + createIfNotExists) par jour/type.
    // Un échec partiel est inoffensif : les abonnements non traités seront
    // repris à la prochaine exécution du CRON.
    try {
      await creerNotificationSiAbsente(
        siteId,
        abonnement.userId,
        TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT,
        titre,
        message,
        "/abonnement"
      );
      envoyes++;
    } catch (err) {
      console.error(
        `[rappels-abonnement] Échec notification pour abonnement ${abonnement.id} (userId=${abonnement.userId}):`,
        err
      );
      // On continue : les autres abonnements ne doivent pas être bloqués
    }
  }

  return { envoyes };
}

/**
 * src/lib/services/remises-automatiques.ts
 *
 * Service de remises automatiques.
 * Vérifie et applique automatiquement une remise EARLY_ADOPTER lors
 * de la première souscription d'un site.
 *
 * R2 : Importer les enums depuis "@/types"
 * R4 : appliquerRemise via transaction atomique (dans queries/remises.ts)
 * R8 : siteId obligatoire pour vérifier l'historique d'abonnement
 *
 * Story 35.2 — Sprint 35
 */

import { prisma } from "@/lib/db";
import { TypeRemise } from "@/types";
import { appliquerRemise } from "@/lib/queries/remises";

/**
 * Vérifie et applique automatiquement une remise EARLY_ADOPTER
 * lors de la première souscription d'un site.
 *
 * Logique :
 * 1. Vérifier que c'est le 1er abonnement payant du site (pas d'historique)
 * 2. Chercher la remise globale EARLY_ADOPTER active + non expirée avec la plus grande valeur
 * 3. Si trouvée et limite non atteinte : appliquer via appliquerRemise()
 * 4. Retourner la remise appliquée ou null
 *
 * @param siteId - ID du site qui souscrit
 * @param abonnementId - ID du nouvel abonnement créé
 * @param userId - ID de l'utilisateur effectuant la souscription
 * @returns La remise appliquée ou null
 */
export async function verifierEtAppliquerRemiseAutomatique(
  siteId: string,
  abonnementId: string,
  userId: string
): Promise<{ id: string; nom: string; code: string; valeur: number; estPourcentage: boolean } | null> {
  try {
    // Étape 1 : Vérifier que c'est le premier abonnement du site
    // (compter les abonnements existants hors celui qu'on vient de créer)
    const abonnementsExistants = await prisma.abonnement.count({
      where: {
        siteId,
        id: { not: abonnementId }, // exclure l'abonnement actuel
      },
    });

    if (abonnementsExistants > 0) {
      // Ce n'est pas la première souscription — pas de remise automatique
      return null;
    }

    // Étape 2 : Chercher la meilleure remise EARLY_ADOPTER globale active
    const maintenant = new Date();
    const remisesEarlyAdopter = await prisma.remise.findMany({
      where: {
        type: TypeRemise.EARLY_ADOPTER,
        isActif: true,
        siteId: null, // globale uniquement
        dateDebut: { lte: maintenant },
        // Pas encore expirée (dateFin null = sans expiration, ou dateFin dans le futur)
        OR: [
          { dateFin: null },
          { dateFin: { gt: maintenant } },
        ],
        // Note : la vérification limiteUtilisations < nombreUtilisations est faite en JS ci-dessous
        // car Prisma ne supporte pas la comparaison de deux colonnes de la même table dans where
      },
      orderBy: [
        { valeur: "desc" }, // la plus grande valeur en premier
      ],
    });

    // Filtrer celles qui ont encore des utilisations disponibles
    const remisesDisponibles = remisesEarlyAdopter.filter(
      (r) =>
        r.limiteUtilisations === null ||
        r.nombreUtilisations < r.limiteUtilisations
    );

    if (remisesDisponibles.length === 0) {
      return null;
    }

    const remise = remisesDisponibles[0]!;

    // Étape 3 : Appliquer la remise — montantReduit calculé depuis l'abonnement
    const abonnement = await prisma.abonnement.findUnique({
      where: { id: abonnementId },
      select: { prixPaye: true },
    });

    if (!abonnement) {
      return null;
    }

    // Calculer le montant réduit
    let montantReduit: number;
    const valeur = Number(remise.valeur);
    const prixPaye = Number(abonnement.prixPaye);

    if (remise.estPourcentage) {
      montantReduit = Math.round(prixPaye * (valeur / 100));
    } else {
      montantReduit = Math.min(valeur, prixPaye); // ne pas réduire en dessous de 0
    }

    // Appliquer via la query atomique (transaction)
    await appliquerRemise(remise.id, abonnementId, userId, montantReduit);

    return {
      id: remise.id,
      nom: remise.nom,
      code: remise.code,
      valeur,
      estPourcentage: remise.estPourcentage,
    };
  } catch (error) {
    // Fire-and-forget : ne pas bloquer la souscription si erreur
    console.error("[remises-automatiques] Erreur lors de l'application automatique :", error);
    return null;
  }
}

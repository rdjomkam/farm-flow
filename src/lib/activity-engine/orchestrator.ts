/**
 * orchestrator.ts — Fonctions d'orchestration du moteur d'activites.
 *
 * - runEngineForSite : execute le moteur complet pour un site (regles → contextes → generation)
 * - generateOnboardingActivities : cree l'activite de bienvenue lors de l'activation d'un pack
 *
 * Extraite de la route CRON pour etre reutilisable (pack activation, tests, etc.).
 */

import { prisma } from "@/lib/db";
import { StatutVague, TypeActivite, StatutActivite, PhaseElevage } from "@/types";
import type { CustomPlaceholder } from "@/types";
import type { RuleEvaluationContext } from "@/types/activity-engine";
import {
  buildEvaluationContext,
  evaluateRules,
  generateActivities,
} from "./index";

// ---------------------------------------------------------------------------
// runEngineForSite
// ---------------------------------------------------------------------------

export async function runEngineForSite(
  siteId: string,
  systemUserId: string,
  options?: { defaultAssigneeId?: string | null }
): Promise<{ created: number; skipped: number; errors: string[] }> {
  // ---- Charger les custom placeholders (globaux) ----
  const customPlaceholders = await prisma.customPlaceholder.findMany({
    where: { isActive: true },
    orderBy: { key: "asc" },
  }) as unknown as CustomPlaceholder[];

  // ---- Charger les vagues actives ----
  const vaguesActives = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    include: {
      bacs: {
        where: { vagueId: { not: null } },
        select: {
          id: true,
          nom: true,
          volume: true,
          nombrePoissons: true,
          nombreInitial: true,
          poidsMoyenInitial: true,
        },
      },
      releves: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          typeReleve: true,
          date: true,
          poidsMoyen: true,
          tailleMoyenne: true,
          nombreMorts: true,
          quantiteAliment: true,
          temperature: true,
          ph: true,
          oxygene: true,
          ammoniac: true,
          nombreCompte: true,
          bacId: true,
          pourcentageRenouvellement: true,
          volumeRenouvele: true,
        },
      },
      configElevage: true,
    },
  });

  if (vaguesActives.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Charger le stock du site ----
  const produits = await prisma.produit.findMany({
    where: { siteId, isActive: true },
    select: {
      id: true,
      nom: true,
      categorie: true,
      unite: true,
      seuilAlerte: true,
      stockActuel: true,
    },
  });

  // ---- Charger les regles applicables ----
  // Regles du site + regles globales (siteId IS NULL)
  const regles = await prisma.regleActivite.findMany({
    where: {
      isActive: true,
      OR: [{ siteId }, { siteId: null }],
    },
    include: {
      conditions: { orderBy: { ordre: "asc" } },
    },
  });

  if (regles.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Charger l'historique des activites recentes (30 derniers jours) ----
  const trenteDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const historique = await prisma.activite.findMany({
    where: {
      siteId,
      regleId: { not: null },
      createdAt: { gte: trenteDaysAgo },
    },
    select: {
      id: true,
      regleId: true,
      vagueId: true,
      bacId: true,
      dateDebut: true,
      createdAt: true,
    },
  });

  // Typer l'historique pour l'evaluateur
  const historiqueTyped = historique.map((a) => ({
    id: a.id,
    regleId: a.regleId,
    vagueId: a.vagueId,
    bacId: a.bacId,
    dateDebut: a.dateDebut,
    createdAt: a.createdAt,
  })) as Array<{
    id: string;
    regleId: string | null;
    vagueId: string | null;
    bacId: string | null;
    dateDebut: Date;
    createdAt: Date;
  }>;

  // ---- Construire les contextes (per-bac) ----
  const contextes: RuleEvaluationContext[] = [];
  for (const vague of vaguesActives) {
    const vagueCtx = {
      id: vague.id,
      code: vague.code,
      dateDebut: vague.dateDebut,
      nombreInitial: vague.nombreInitial,
      poidsMoyenInitial: vague.poidsMoyenInitial,
      siteId: vague.siteId,
    };
    const relevesCast = vague.releves as unknown as Parameters<typeof buildEvaluationContext>[1];
    const stockCast = produits as unknown as Parameters<typeof buildEvaluationContext>[2];
    const configCast = (vague.configElevage ?? null) as unknown as Parameters<typeof buildEvaluationContext>[3];

    if (vague.bacs && vague.bacs.length > 0) {
      const allBacsCast = vague.bacs as unknown as Parameters<typeof buildEvaluationContext>[5];
      // Per-bac contexts
      for (const bac of vague.bacs) {
        contextes.push(
          buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, bac, allBacsCast)
        );
      }
      // Also add a vague-level context (bac: null) for STOCK_BAS rules
      contextes.push(
        buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, null)
      );
    } else {
      // No bacs → vague-level context only (fallback)
      contextes.push(
        buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, null)
      );
    }
  }

  // ---- Evaluer les regles ----
  const matches = evaluateRules(
    contextes,
    regles as Parameters<typeof evaluateRules>[1],
    historiqueTyped as Parameters<typeof evaluateRules>[2]
  );

  if (matches.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Generer les activites ----
  // Utiliser la config du premier match comme config site (ou null)
  const firstConfigElevageRaw =
    vaguesActives.find((v) => v.configElevage)?.configElevage ?? null;

  // Cast necessaire : Prisma retourne JsonValue pour les champs alimentTailleConfig/alimentTauxConfig,
  // notre interface ConfigElevage attend AlimentTailleEntree[] / AlimentTauxEntree[].
  // Les structures sont identiques au runtime — le cast est sur.
  const firstConfigElevage = firstConfigElevageRaw as unknown as Parameters<typeof generateActivities>[3];

  return generateActivities(
    matches,
    siteId,
    systemUserId,
    firstConfigElevage,
    options?.defaultAssigneeId ?? null,
    customPlaceholders
  );
}

// ---------------------------------------------------------------------------
// generateOnboardingActivities
// ---------------------------------------------------------------------------

/**
 * Cree une activite de bienvenue/onboarding pour un nouveau client.
 * Activite non liee a une regle — guide de demarrage pour le premier jour.
 *
 * @returns Nombre d'activites creees (1 si succes, 0 sinon)
 */
export async function generateOnboardingActivities(
  siteId: string,
  vagueId: string,
  assigneeId: string,
  systemUserId: string,
  vagueCode: string,
  nombreInitial: number
): Promise<number> {
  const instructionsDetaillees = `## Vos premieres actions

1. **Verifier vos bacs** — Allez dans l'onglet "Bacs" et confirmez que la configuration correspond a votre installation.

2. **Premier releve de temperature** — Mesurez la temperature de l'eau dans chaque bac. Plage optimale : 25-32°C. Saisissez le resultat dans "Nouveau releve" > "Qualite eau".

3. **Premier nourrissage** — La quantite d'aliment recommandee sera affichee dans vos taches quotidiennes. Distribuez en 3-4 repas repartis sur la journee.

4. **Observer vos poissons** — Notez leur comportement apres la mise en bac : agitation normale, nage de surface (manque O2), signes de stress.

5. **Consulter vos taches quotidiennes** — Chaque jour, des taches seront generees automatiquement : alimentation, temperature, nettoyage, observation. Suivez-les pour un elevage optimal.

## Vos ressources

- **Mes taches** : liste quotidienne de ce que vous devez faire
- **Vagues** : suivi de vos lots de poissons
- **Bacs** : etat de vos bacs d'elevage
- **Stock** : gestion de votre aliment et materiel
- **Releves** : saisie de vos mesures (biometrie, mortalite, alimentation, qualite eau)

## Conseil DKFarm

Durant la phase d'acclimatation (premiers jours), surveillez particulierement :
- La temperature (25-32°C ideal)
- Le comportement a la surface (nage de surface = manque d'oxygene)
- Les mortalites (retirer les poissons morts immediatement)
- La consommation d'aliment (ajuster si refus > 10%)`;

  await prisma.activite.create({
    data: {
      titre: "Bienvenue ! Votre guide de demarrage",
      description: `Votre elevage a ete configure avec la vague ${vagueCode} (${nombreInitial} alevins). Voici les etapes essentielles pour bien demarrer.`,
      typeActivite: TypeActivite.AUTRE,
      statut: StatutActivite.PLANIFIEE,
      dateDebut: new Date(),
      dateFin: null,
      recurrence: null,
      vagueId,
      bacId: null,
      assigneAId: assigneeId,
      userId: systemUserId,
      siteId,
      regleId: null,
      instructionsDetaillees,
      conseilIA: "Phase d'acclimatation : les 7 premiers jours sont critiques. Surveillez temperature et mortalite quotidiennement. Ne suralimentez pas.",
      produitRecommandeId: null,
      quantiteRecommandee: null,
      priorite: 1,
      isAutoGenerated: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      phaseElevage: PhaseElevage.ACCLIMATATION as any,
    },
  });

  return 1;
}

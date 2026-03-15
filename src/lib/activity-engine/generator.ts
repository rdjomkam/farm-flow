/**
 * generator.ts — Generation et persistance des activites depuis les RuleMatch.
 *
 * Pour chaque RuleMatch produit par l'evaluateur :
 *   1. Resoudre les templates (titre, description, instructions)
 *   2. Calculer la quantite d'aliment si applicable
 *   3. Verifier la deduplication (EC-3.1)
 *   4. Creer l'Activite en base via transaction Prisma (R4)
 *   5. Marquer firedOnce=true pour les SEUIL_* (EC-3.2, operation atomique)
 *
 * EC-3.3 : Si conflit de priorite entre regles, la plus basse (=plus urgent) gagne.
 */

import { prisma } from "@/lib/db";
import type { RegleActivite, ConfigElevage } from "@/types";
import {
  TypeDeclencheur,
  TypeActivite,
  StatutActivite,
} from "@/types";
import type { RuleMatch, GeneratedActivity } from "@/types/activity-engine";
import { resolveTemplate, buildPlaceholders } from "./template-engine";
import { calculerQuantiteAliment } from "./feeding";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Types de declencheurs one-shot (firedOnce) */
const FIRED_ONCE_TYPES: TypeDeclencheur[] = [
  TypeDeclencheur.SEUIL_POIDS,
  TypeDeclencheur.SEUIL_QUALITE,
  TypeDeclencheur.SEUIL_MORTALITE,
  TypeDeclencheur.FCR_ELEVE,
  TypeDeclencheur.STOCK_BAS,
];

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

export interface GeneratorResult {
  created: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifie si une activite avec le meme regleId + vagueId existe deja aujourd'hui.
 * Utilise le client transactionnel pour la coherence.
 * EC-3.1
 */
async function hasDuplicateToday(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  regleId: string,
  vagueId: string
): Promise<boolean> {
  const WAT_OFFSET_MS = 1 * 60 * 60 * 1000;
  const nowWAT = new Date(Date.now() + WAT_OFFSET_MS);
  const startOfDayWAT = new Date(nowWAT);
  startOfDayWAT.setHours(0, 0, 0, 0);
  const endOfDayWAT = new Date(nowWAT);
  endOfDayWAT.setHours(23, 59, 59, 999);

  const existing = await tx.activite.findFirst({
    where: {
      regleId,
      vagueId,
      createdAt: {
        gte: new Date(startOfDayWAT.getTime() - WAT_OFFSET_MS),
        lte: new Date(endOfDayWAT.getTime() - WAT_OFFSET_MS),
      },
    },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Construit le payload GeneratedActivity a partir d'un RuleMatch.
 */
function buildGeneratedActivity(
  match: RuleMatch,
  siteId: string,
  systemUserId: string,
  configElevage: ConfigElevage | null
): GeneratedActivity {
  const { regle, context } = match;

  // ---- Calcul alimentation si applicable ----
  let quantiteGrammes: number | null = null;
  let tailleGranule: string | null = null;

  if (regle.typeActivite === TypeActivite.ALIMENTATION) {
    const feeding = calculerQuantiteAliment(context, configElevage);
    if (feeding) {
      quantiteGrammes = feeding.quantiteGrammes;
      tailleGranule = feeding.tailleGranule;
    }
  }

  // ---- Stock du produit recommande ----
  // Note : RegleActivite n'a pas de produitRecommandeId dans ce schema.
  // L'information est portee par le stock en alerte.
  let stockQte: number | null = null;
  let produitNom: string | null = null;

  // Chercher le produit en alerte le plus critique pour les regles STOCK_BAS
  if (context.stock.length > 0) {
    const produitEnAlerte = context.stock.find((s) => s.estEnAlerte);
    if (produitEnAlerte) {
      stockQte = produitEnAlerte.quantiteActuelle;
      produitNom = produitEnAlerte.produit.nom;
    }
  }

  // ---- Duree estimee du cycle ----
  // Non expose dans le contexte simplifie → fallback 180j
  const dureeEstimee = 180;

  // ---- Placeholders ----
  const placeholders = buildPlaceholders(
    {
      joursEcoules: context.joursEcoules,
      semaine: context.semaine,
      vague: { code: context.vague.code },
      indicateurs: {
        poidsMoyen: context.indicateurs.poidsMoyen,
        fcr: context.indicateurs.fcr,
        sgr: context.indicateurs.sgr,
        tauxSurvie: context.indicateurs.tauxSurvie,
        tauxMortaliteCumule: context.indicateurs.tauxMortaliteCumule,
        biomasse: context.indicateurs.biomasse,
      },
      derniersReleves: context.derniersReleves.map((r) => ({
        typeReleve: r.typeReleve,
        tailleMoyenne: r.tailleMoyenne,
        date: r.date,
      })),
    },
    {
      quantiteCalculee: quantiteGrammes,
      produitNom,
      seuilValeur: regle.conditionValeur,
      quantiteRegle: null, // RegleActivite n'a pas quantiteRecommandee dans ce schema
      tailleGranule,
      dureeEstimee,
      stockQte,
      tauxRationnement: null,
      // bacNom : non disponible dans le contexte simplifie (pas de relation bac chargee)
      bacNom: null,
      // prixMarcheKg : non expose dans ConfigElevage → valeur marchande non calculee
      prixMarcheKg: null,
    }
  );

  // ---- Resoudre les templates ----
  const titre = resolveTemplate(regle.titreTemplate, placeholders);
  const description = regle.descriptionTemplate
    ? resolveTemplate(regle.descriptionTemplate, placeholders)
    : null;
  const instructionsDetaillees = regle.instructionsTemplate
    ? resolveTemplate(regle.instructionsTemplate, placeholders)
    : null;

  // ---- Conseil IA contextuel ----
  let conseilIA: string | null = null;
  if (
    regle.typeDeclencheur === TypeDeclencheur.FCR_ELEVE &&
    context.indicateurs.fcr != null
  ) {
    conseilIA = `FCR eleve (${context.indicateurs.fcr.toFixed(2)}) : envisager de reduire la ration journaliere de 10-15%.`;
  } else if (
    regle.typeDeclencheur === TypeDeclencheur.SEUIL_MORTALITE &&
    context.indicateurs.tauxMortaliteCumule != null
  ) {
    conseilIA = `Mortalite cumulee a ${context.indicateurs.tauxMortaliteCumule.toFixed(1)}% : verifier la qualite de l'eau et les parametres d'elevage.`;
  } else if (
    regle.typeDeclencheur === TypeDeclencheur.STOCK_BAS
  ) {
    conseilIA = `Stock d'aliment bas : passer une commande au plus vite pour eviter une rupture.`;
  }

  const now = new Date();

  return {
    titre,
    description,
    typeActivite: regle.typeActivite as TypeActivite,
    statut: StatutActivite.PLANIFIEE,
    dateDebut: now,
    dateFin: null,
    recurrence: null,
    vagueId: context.vague.id,
    bacId: null,
    assigneAId: null,
    userId: systemUserId,
    siteId,
    regleId: regle.id,
    instructionsDetaillees,
    conseilIA,
    produitRecommandeId: null, // sera enrichi manuellement si besoin
    quantiteRecommandee: quantiteGrammes,
    priorite: regle.priorite,
    isAutoGenerated: true,
    phaseElevage: context.phase,
  };
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Genere les activites correspondant aux RuleMatch et les persiste en base.
 *
 * Chaque activite est creee dans une transaction individuelle pour garantir
 * l'atomicite et eviter les doublons (R4).
 *
 * @param matches       - Liste des RuleMatch produits par l'evaluateur
 * @param siteId        - ID du site
 * @param systemUserId  - ID de l'utilisateur systeme (SYSTEM_USER_ID)
 * @param configElevage - Configuration d'elevage du site (nullable)
 * @returns             Bilan de la generation (crees, sautes, erreurs)
 */
export async function generateActivities(
  matches: RuleMatch[],
  siteId: string,
  systemUserId: string,
  configElevage: ConfigElevage | null = null
): Promise<GeneratorResult> {
  const result: GeneratorResult = { created: 0, skipped: 0, errors: [] };

  // Grouper les matches par vagueId pour appliquer EC-3.3
  // (conflits de priorite : la plus basse = plus urgent l'emporte)
  const matchesByVague = new Map<string, RuleMatch[]>();
  for (const match of matches) {
    const vagueId = match.vague.id;
    const existing = matchesByVague.get(vagueId) ?? [];
    existing.push(match);
    matchesByVague.set(vagueId, existing);
  }

  for (const [, vagueMatches] of matchesByVague) {
    // EC-3.3 : trier par priorite (plus basse = plus urgent = generer en premier)
    const sorted = [...vagueMatches].sort((a, b) => a.regle.priorite - b.regle.priorite);

    for (const match of sorted) {
      try {
        const { regle } = match;

        await prisma.$transaction(async (tx) => {
          // EC-3.1 : deduplication dans la transaction
          const duplicate = await hasDuplicateToday(tx, regle.id, match.vague.id);
          if (duplicate) {
            result.skipped++;
            return;
          }

          // Construire le payload
          const payload = buildGeneratedActivity(
            match,
            siteId,
            systemUserId,
            configElevage
          );

          // Creer l'activite
          await tx.activite.create({
            data: {
              titre: payload.titre,
              description: payload.description,
              typeActivite: payload.typeActivite,
              statut: payload.statut,
              dateDebut: payload.dateDebut,
              dateFin: payload.dateFin,
              recurrence: payload.recurrence,
              vagueId: payload.vagueId,
              bacId: payload.bacId,
              assigneAId: payload.assigneAId,
              userId: payload.userId,
              siteId: payload.siteId,
              regleId: payload.regleId,
              instructionsDetaillees: payload.instructionsDetaillees,
              conseilIA: payload.conseilIA,
              produitRecommandeId: payload.produitRecommandeId,
              quantiteRecommandee: payload.quantiteRecommandee,
              priorite: payload.priorite,
              isAutoGenerated: true,
              // Cast: context.phase est string | null, Prisma attend PhaseElevage enum
              // Les valeurs sont identiques au runtime (ex: "GROSSISSEMENT")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              phaseElevage: (payload.phaseElevage as any) ?? null,
            },
          });

          // EC-3.2 : marquer firedOnce=true pour les SEUIL_* (operation atomique R4)
          if (FIRED_ONCE_TYPES.includes(regle.typeDeclencheur as TypeDeclencheur)) {
            await tx.regleActivite.updateMany({
              where: {
                id: regle.id,
                firedOnce: false, // Condition atomique — evite la race condition
              },
              data: { firedOnce: true },
            });
          }

          result.created++;
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(
          `Erreur regle ${match.regle.id} / vague ${match.vague.id} : ${msg}`
        );
        console.error("[ActivityEngine/generator] Error:", error);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Re-export du type GeneratedActivity pour les consommateurs
// ---------------------------------------------------------------------------
export type { GeneratedActivity } from "@/types/activity-engine";

/**
 * src/lib/queries/previsions-postes-referentiel.ts
 *
 * Queries Prisma — `PosteReferentiel` (ADR-053 §16, stories A.4/A.5).
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture — une entree d'un autre site est
 * INTROUVABLE (404), jamais INTERDITE (403) : ne jamais reveler l'existence d'une ressource
 * d'un autre site (ADR-053 §16.12 "Contrat des routes").
 * R4 : renommage/desactivation/reactivation utilisent `updateMany` avec conditions (dont
 * `siteId`), jamais un check-then-update.
 *
 * Peuplement : `PosteReferentiel` est cree exclusivement par la branche (b) du contrat XOR de
 * `createPostePrevision` (`src/lib/queries/previsions-charges.ts`, ADR-053 §16.12) — aucune
 * route de creation directe n'est livree par ces stories.
 *
 * Filtrage sur `actif` — distinction stricte (ADR-053 §16.12 "Arbitrage 2") :
 *   - `listerPostesReferentielActifs` (ACTIFS seuls) sert la selection pour un NOUVEAU
 *     rattachement (formulaire de creation de PostePrevision, formulaire de mapping) ;
 *   - `listerPostesReferentielAdmin` (ACTIFS + INACTIFS) sert l'ecran d'administration
 *     uniquement ;
 *   - la RESOLUTION/LECTURE d'un rattachement DEJA EXISTANT (`getPostesPrevisionParScenario`,
 *     la resolution de mapping) NE FILTRE JAMAIS sur `actif` — desactiver une entree bloque
 *     uniquement les NOUVEAUX rattachements, ne casse jamais l'existant.
 */
import { prisma } from "@/lib/db";
import { BusinessRuleError } from "@/lib/errors";

/**
 * Liste les entrees `PosteReferentiel` ACTIVES d'un site — consommee par
 * `mapping-form-dialog.tsx` (cibleType = POSTE_PREVISION) et par l'onglet "Rechercher" du
 * parcours de creation d'un `PostePrevision` (ADR-053 §16.12 "Design du parcours a deux temps")
 * pour choisir un `posteReferentielId` site-scope. Filtrage `actif: true` : c'est la SEULE
 * fonction (avec le get-or-create de `createPostePrevision`) qui doit filtrer sur `actif` — un
 * NOUVEAU rattachement ne doit jamais proposer une entree desactivee.
 */
export async function listerPostesReferentielActifs(siteId: string) {
  return prisma.posteReferentiel.findMany({
    where: { siteId, actif: true },
    orderBy: { libelle: "asc" },
  });
}

/**
 * Liste TOUTES les entrees `PosteReferentiel` d'un site (actives ET inactives), avec de quoi
 * afficher l'etat — consommee exclusivement par l'ecran d'administration
 * `/previsions/postes-referentiel` (`GET /api/previsions/postes-referentiel/admin`,
 * `PREVISIONS_PARAMETRER`, ADR-053 §16.12 "Contrat des routes"). Distincte de
 * `listerPostesReferentielActifs` (ACTIFS seuls, `PREVISIONS_VOIR`) — ne jamais fusionner les
 * deux fonctions : le filtrage sur `actif` est une decision explicite par appelant, pas un
 * defaut implicite.
 */
export async function listerPostesReferentielAdmin(siteId: string) {
  return prisma.posteReferentiel.findMany({
    where: { siteId },
    orderBy: { libelle: "asc" },
  });
}

/**
 * Renomme une entree `PosteReferentiel` — `libelle` SEULEMENT, `code` reste FIGE (ADR-053
 * §16.12 "Arbitrage 1" : `code` est la clef de dedoublonnage du get-or-create de
 * `createPostePrevision`, le renommer romprait cette clef et provoquerait un doublon silencieux
 * a la prochaine creation avec le libelle d'origine).
 *
 * R4 : `updateMany` avec conditions (`id`, `siteId`) — pas de check-then-update. R8 : une
 * entree d'un autre site est introuvable, jamais un `count === 0` distinct.
 *
 * @throws {Error} "PosteReferentiel introuvable" si absente ou d'un autre site — la route
 *   mappe ce message vers 404 (jamais 403, `handleApiError` pattern "introuvable" -> 404).
 */
export async function renommerPosteReferentiel(id: string, siteId: string, libelle: string) {
  const libelleTrim = libelle.trim();
  if (libelleTrim === "") {
    throw new BusinessRuleError("Le libelle est obligatoire.", 400, "POSTE_REFERENTIEL_LIBELLE_REQUIS");
  }

  const { count } = await prisma.posteReferentiel.updateMany({
    where: { id, siteId },
    data: { libelle: libelleTrim },
  });
  if (count === 0) {
    throw new Error("PosteReferentiel introuvable");
  }
  return prisma.posteReferentiel.findUniqueOrThrow({ where: { id } });
}

/**
 * Desactive une entree `PosteReferentiel` (`actif = false`) — bloque uniquement la CREATION de
 * nouveaux `PostePrevision`/`MappingRapprochement` la ciblant (branches (a)/(b) de
 * `createPostePrevision`, `listerPostesReferentielActifs`) ; n'affecte JAMAIS les
 * `PostePrevision`/`MappingRapprochement` deja lies (ADR-053 §16.12 "Arbitrage 2").
 *
 * Idempotent : desactiver une entree deja desactivee n'est pas une erreur metier (retourne
 * l'etat courant sans lever). R4 : `updateMany` avec conditions, R8 : site-scope strict.
 *
 * @throws {Error} "PosteReferentiel introuvable" si absente ou d'un autre site.
 */
export async function desactiverPosteReferentiel(id: string, siteId: string) {
  const existant = await prisma.posteReferentiel.findFirst({ where: { id, siteId } });
  if (!existant) {
    throw new Error("PosteReferentiel introuvable");
  }
  if (!existant.actif) {
    return existant; // idempotent — pas de 409
  }
  const { count } = await prisma.posteReferentiel.updateMany({
    where: { id, siteId, actif: true },
    data: { actif: false },
  });
  if (count === 0) {
    // Course concurrente : desactivee entre le findFirst et le updateMany — l'etat final
    // (desactivee) est de toute facon celui vise, relire pour repondre 200 idempotent.
    return prisma.posteReferentiel.findUniqueOrThrow({ where: { id } });
  }
  return prisma.posteReferentiel.findUniqueOrThrow({ where: { id } });
}

/**
 * Reactive une entree `PosteReferentiel` (`actif = true`) — operation symetrique et sans effet
 * de bord (aucun champ n'a ete ecrase a la desactivation, rien a restaurer d'autre que `actif`).
 *
 * Idempotent : reactiver une entree deja active n'est pas une erreur metier. R4 : `updateMany`
 * avec conditions, R8 : site-scope strict.
 *
 * @throws {Error} "PosteReferentiel introuvable" si absente ou d'un autre site.
 */
export async function reactiverPosteReferentiel(id: string, siteId: string) {
  const existant = await prisma.posteReferentiel.findFirst({ where: { id, siteId } });
  if (!existant) {
    throw new Error("PosteReferentiel introuvable");
  }
  if (existant.actif) {
    return existant; // idempotent — pas de 409
  }
  const { count } = await prisma.posteReferentiel.updateMany({
    where: { id, siteId, actif: false },
    data: { actif: true },
  });
  if (count === 0) {
    return prisma.posteReferentiel.findUniqueOrThrow({ where: { id } });
  }
  return prisma.posteReferentiel.findUniqueOrThrow({ where: { id } });
}

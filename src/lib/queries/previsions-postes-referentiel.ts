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
import { CibleRapprochement } from "@/types";

/**
 * Liste les entrees `PosteReferentiel` ACTIVES d'un site — consommee par l'onglet
 * "Rechercher" du parcours de creation d'un `PostePrevision` (ADR-053 §16.12 "Design du
 * parcours a deux temps") pour choisir un `posteReferentielId` site-scope. Depuis R2,
 * `mapping-form-dialog.tsx` ne consomme plus cette fonction : il consomme desormais la route
 * admin (`listerPostesReferentielAdmin`). Filtrage `actif: true` : c'est la SEULE fonction (avec
 * le get-or-create de `createPostePrevision`) qui doit filtrer sur `actif` — un NOUVEAU
 * rattachement ne doit jamais proposer une entree desactivee.
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
  // Deux requetes FIXES pour toute la liste, jamais N (une par entree) — c'est
  // l'exigence explicite de la reserve R3 (PR2non.3) :
  //
  // (1) `nbPostesRattaches` : `PostePrevision.posteReferentielId` est une VRAIE
  //     FK Prisma (`onDelete: Restrict`, cf. `PostePrevision.posteReferentielId`
  //     ci-dessus) -> `_count` relationnel natif, fusionne par Prisma dans la
  //     MEME requete SQL que le `findMany` (une jointure, pas une requete a part).
  //
  // (2) `nbMappingsRattaches` : `MappingRapprochement.cibleId` n'est PAS une FK
  //     (litteral polymorphe, ADR-053 §16.3/ERR-183) -> aucun `_count` relationnel
  //     possible. Une seule requete d'agregation `groupBy` couvre TOUS les
  //     `PosteReferentiel` du site en un coup, fusionnee en memoire ensuite.
  const [entries, mappingCounts] = await Promise.all([
    prisma.posteReferentiel.findMany({
      where: { siteId },
      orderBy: { libelle: "asc" },
      include: { _count: { select: { postes: true } } },
    }),
    prisma.mappingRapprochement.groupBy({
      by: ["cibleId"],
      where: { siteId, cibleType: CibleRapprochement.POSTE_PREVISION, actif: true },
      _count: true,
    }),
  ]);

  const nbMappingsParCible = new Map<string, number>(
    mappingCounts
      .filter((m): m is typeof m & { cibleId: string } => m.cibleId !== null)
      .map((m) => [m.cibleId, m._count])
  );

  return entries.map(({ _count, ...entry }) => ({
    ...entry,
    nbPostesRattaches: _count.postes,
    // `?? 0` legitime ICI seulement : le `groupBy` ci-dessus couvre 100% des
    // MappingRapprochement ACTIFS du site (meme `siteId` que `entries`, meme
    // `cibleType`) — une entree absente de `nbMappingsParCible` est donc
    // PROUVEE a zero mapping, ce n'est pas un echec de resolution masque en 0
    // (l'anti-pattern ERR-173/ERR-179). Ne jamais reproduire ce `?? 0` pour un
    // decompte qui ne serait pas issu d'une requete couvrant l'univers complet.
    nbMappingsRattaches: nbMappingsParCible.get(entry.id) ?? 0,
  }));
}

/**
 * Recharge UNE entree `PosteReferentiel` enrichie des deux decomptes
 * (`nbPostesRattaches`, `nbMappingsRattaches`) — meme forme que
 * `listerPostesReferentielAdmin`, mais pour un seul `id`. C'est le SEUL point
 * de sortie utilise par les trois mutations ci-dessous (renommer/desactiver/
 * reactiver), y compris leurs retours idempotents : `PosteReferentielDTO`
 * n'a QUE des champs non-optionnels pour ces deux decomptes (reserve R3,
 * PR2non.3) — un retour de mutation qui ne les fournit pas n'est pas juste
 * incomplet, il rend `undefined` un champ que le contrat promet toujours
 * present, et `Intl.PluralRules.select(NaN)` degrade silencieusement en
 * "NaN postes de charge rattaches" cote client (ERR-188).
 *
 * R8 : site-scope strict — `findFirst` filtre sur `siteId`, jamais un simple
 * `findUnique({ where: { id } })`.
 *
 * @throws {Error} "PosteReferentiel introuvable" si absente ou d'un autre site.
 */
async function getPosteReferentielAdmin(id: string, siteId: string) {
  const entry = await prisma.posteReferentiel.findFirst({
    where: { id, siteId },
    include: { _count: { select: { postes: true } } },
  });
  if (!entry) {
    throw new Error("PosteReferentiel introuvable");
  }

  const nbMappingsRattaches = await prisma.mappingRapprochement.count({
    where: { siteId, cibleType: CibleRapprochement.POSTE_PREVISION, actif: true, cibleId: id },
  });

  const { _count, ...rest } = entry;
  return {
    ...rest,
    nbPostesRattaches: _count.postes,
    // `?? 0` n'est PAS applique ici : `count()` renvoie deja 0 nativement
    // quand aucune ligne ne correspond (pas de resolution masquee a
    // justifier) — a la difference du `Map.get(...) ?? 0` de
    // `listerPostesReferentielAdmin`, ou l'absence d'entree dans la Map
    // devait etre distinguee explicitement d'un echec de resolution.
    nbMappingsRattaches,
  };
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
  return getPosteReferentielAdmin(id, siteId);
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
    return getPosteReferentielAdmin(id, siteId); // idempotent — pas de 409
  }
  const { count } = await prisma.posteReferentiel.updateMany({
    where: { id, siteId, actif: true },
    data: { actif: false },
  });
  if (count === 0) {
    // Course concurrente : desactivee entre le findFirst et le updateMany — l'etat final
    // (desactivee) est de toute facon celui vise, relire pour repondre 200 idempotent.
    return getPosteReferentielAdmin(id, siteId);
  }
  return getPosteReferentielAdmin(id, siteId);
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
    return getPosteReferentielAdmin(id, siteId); // idempotent — pas de 409
  }
  const { count } = await prisma.posteReferentiel.updateMany({
    where: { id, siteId, actif: false },
    data: { actif: true },
  });
  if (count === 0) {
    return getPosteReferentielAdmin(id, siteId);
  }
  return getPosteReferentielAdmin(id, siteId);
}

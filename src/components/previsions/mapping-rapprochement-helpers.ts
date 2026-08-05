/**
 * src/components/previsions/mapping-rapprochement-helpers.ts
 *
 * Traduction lisible d'une paire (`sourceType`, `sourceCle`) de
 * `MappingRapprochement`/`CategorieReelleNonMappee` (Sprint PR3-bis, story
 * PR3bis.3, pre-analyse section 1).
 *
 * `sourceCle` est une VALEUR LITTERALE D'ENUM REEL, jamais un libelle
 * (ex. "ALIMENT" pour `CategorieDepense`, "G3" pour `TailleGranule`,
 * "INCONNU" pour une sortie de stock sans granulometrie connue) — traduire
 * cote UI evite d'exposer ce code brut a l'exploitant.
 *
 * REUTILISE les referentiels i18n EXISTANTS, n'en cree aucun nouveau (piege
 * deja rencontre dans ce module, cf. mission PR3-bis) :
 * - `DEPENSE_CATEGORIE` -> `depenses.categories.*` (memes valeurs que
 *   `CategorieDepense`, deja utilise par la page Depenses).
 * - `PRODUIT_CATEGORIE` -> `stock.categories.*` (memes valeurs que
 *   `CategorieProduit`).
 * - `MOUVEMENT_STOCK` -> `stock.produits.taillesGranule.*` (memes valeurs
 *   que `TailleGranule`, plus la cle `INCONNU` ajoutee par ce sprint pour le
 *   litteral `"INCONNU"` renvoye par `getCategoriesReellesNonMappees` quand
 *   aucune granulometrie n'est identifiable sur le `Produit`) — EXACTEMENT
 *   le meme referentiel que `aliment-form-dialog.tsx`, jamais un second.
 * - `VENTE` : cle singleton `"VENTE"` (`SourceRapprochement.VENTE`) — pas de
 *   referentiel externe, libelle fixe port par `previsions.rapprochementTab.mapping.venteLabel`.
 *
 * `libelleCible` (correctifs C1/C6, sprint PR3-bis-bis) resout le LIBELLE
 * PRECIS de la cible d'un mapping (`PostePrevision.libelle` ou la
 * granulometrie d'un `AlimentPrevision`), pas seulement son `cibleType` —
 * seule facon de distinguer deux mappings vers deux postes differents sans
 * ouvrir "Modifier". Gere explicitement le cas ou `cibleId` ne correspond a
 * aucune entite du scenario actuellement affiche (RISQUE R1 de la
 * pre-analyse PR3-bis : `MappingRapprochement` est site-scope, sa cible est
 * scenario-scope) — jamais un id brut, jamais un vide silencieux.
 */
import { SourceRapprochement, CibleRapprochement, TailleGranule } from "@/types";
import type { MappingRapprochement } from "@/types";

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * Format compose `cibleId` d'un mapping `ALIMENT_PREVISION` (Sprint PR3-ter,
 * story A.3 — SEULE source de verite : `src/lib/queries/previsions-
 * rapprochement.ts`, section "0bis"). DUPLIQUE ICI VOLONTAIREMENT, meme motif
 * que `src/lib/validation/previsions.schema.ts` (`cibleAlimentPrevisionEstBienFormee`) :
 * `previsions-rapprochement.ts` importe `@/lib/db` (Prisma, cote serveur
 * uniquement) — l'importer depuis un composant `"use client"` casserait le
 * bundle navigateur. Trois copies existent desormais du meme separateur ;
 * une seule le change jamais sans casser un test de non-regression qui
 * verifie explicitement leur egalite (voir
 * `mapping-rapprochement-helpers.test.ts`).
 */
const SEPARATEUR_CIBLE_ALIMENT_PREVISION = "::";

/** Duplicat client-safe de `composeCibleAlimentPrevision` (voir note ci-dessus). */
export function composeCibleAlimentPrevisionClient(
  tailleGranule: TailleGranule,
  alimentPrevisionId: string
): string {
  return `${tailleGranule}${SEPARATEUR_CIBLE_ALIMENT_PREVISION}${alimentPrevisionId}`;
}

/**
 * Extrait la `tailleGranule` d'un `cibleId` compose `ALIMENT_PREVISION` —
 * fonction PURE, aucune I/O, duplicat client-safe de la logique de
 * `parseCibleAlimentPrevision` (voir note ci-dessus). `null` si absent, mal
 * forme, ou si la valeur avant le separateur n'est pas une `TailleGranule`
 * connue (jamais un cast silencieux).
 */
export function extraireTailleGranuleDeCibleId(cibleId: string | null): TailleGranule | null {
  if (!cibleId) return null;
  const indexSeparateur = cibleId.indexOf(SEPARATEUR_CIBLE_ALIMENT_PREVISION);
  if (indexSeparateur <= 0) return null;
  const tailleGranuleBrute = cibleId.slice(0, indexSeparateur);
  return (Object.values(TailleGranule) as string[]).includes(tailleGranuleBrute)
    ? (tailleGranuleBrute as TailleGranule)
    : null;
}

/**
 * Une ligne `MappingRapprochement` augmentee de son etat d'orphelinite
 * (Sprint PR3-ter, story A.2/A.3 — miroir cote client de
 * `LigneMappingAvecOrphelinite`, `src/lib/queries/previsions-mapping-
 * orphelins.ts`). Renvoyee par `GET /api/previsions/mapping-rapprochement`
 * uniquement quand `?scenarioId=` est fourni — sinon `cibleOrpheline` est
 * absent, jamais `false` par defaut trompeur (distinguer "non evalue" de
 * "evalue et non orphelin" n'est pas necessaire cote UI de ce sprint, qui
 * fournit TOUJOURS `scenarioId`, mais le type reste honnete sur ce que
 * l'API garantit).
 */
export interface MappingRapprochementAvecOrphelinite extends MappingRapprochement {
  cibleCleResolue?: string | null;
  cibleOrpheline?: boolean;
}

/** Libelle du `SourceRapprochement` lui-meme (ex. "Categorie de depense"). */
export function libelleSourceType(sourceType: SourceRapprochement, tPrevisions: Translator): string {
  return tPrevisions(`rapprochementTab.mapping.sourceTypes.${sourceType}`);
}

/**
 * Libelle lisible de `sourceCle`, selon son `sourceType` — chaque
 * traducteur est le namespace deja utilise ailleurs dans l'app pour cette
 * meme famille de valeurs (voir en-tete de fichier).
 */
export function libelleSourceCle(
  sourceType: SourceRapprochement,
  sourceCle: string,
  translators: { tDepenses: Translator; tStock: Translator; tPrevisions: Translator }
): string {
  const { tDepenses, tStock, tPrevisions } = translators;
  switch (sourceType) {
    case SourceRapprochement.DEPENSE_CATEGORIE:
      return tDepenses(`categories.${sourceCle}`);
    case SourceRapprochement.PRODUIT_CATEGORIE:
      return tStock(`categories.${sourceCle}`);
    case SourceRapprochement.MOUVEMENT_STOCK:
      return tStock(`produits.taillesGranule.${sourceCle}`);
    case SourceRapprochement.VENTE:
      return tPrevisions("rapprochementTab.mapping.venteLabel");
    default:
      return sourceCle;
  }
}

/** Entites minimales necessaires pour resoudre le libelle d'une cible — sous-ensemble de `PostePrevisionDTO`/`AlimentPrevisionDTO`. */
export interface CiblesDisponibles {
  postes: Array<{ id: string; libelle: string; actif?: boolean }>;
  aliments: Array<{ id: string; tailleGranule: string }>;
}

/**
 * Libelle PRECIS de la cible d'un mapping (correctif C6 : deux mappings
 * `POSTE_PREVISION` differents ne doivent plus afficher le meme badge de
 * type sans distinction).
 *
 * `null` => aucune cible a afficher (cas `NON_RAPPROCHE`/`VENTE_PREVUE`, qui
 * ne portent pas de `cibleId`) : l'appelant n'affiche alors que le badge de
 * type, pas de texte supplementaire.
 *
 * Si `cibleId` est renseigne mais introuvable dans `cibles` (correctif C1 :
 * la cible appartient a un AUTRE scenario que celui actuellement affiche,
 * RISQUE R1 de la pre-analyse), retourne un libelle explicite dedie —
 * jamais l'id brut, jamais une chaine vide.
 *
 * CORRECTIF D2 (contre-review PR3-bis) : `postes`/`aliments` sont charges
 * par un appel reseau distinct de `mappingActif` (`Promise.all` dans
 * `rapprochement-mapping-tab.tsx`) qui peut echouer ISOLEMENT sans
 * declencher l'erreur globale de l'ecran (comportement voulu — l'ecran
 * reste utilisable). Sans ce parametre, un tel echec faisait retomber
 * `libelleCible` sur "introuvable dans ce scenario", ce qui est FAUX et
 * trompeur : la cause reelle est un echec de chargement, pas une cible
 * hors scenario. `ciblesChargees = false` distingue honnetement ce cas.
 *
 * Sprint PR3-ter, story A.2 : pour `ALIMENT_PREVISION`, `cibleId` porte
 * desormais le format compose `tailleGranule::alimentPrevisionId` (story
 * A.3) — la resolution passe par `extraireTailleGranuleDeCibleId` puis une
 * recherche par `tailleGranule` (cle metier stable, jamais par `id`, qui
 * appartient potentiellement a un AUTRE scenario). Comparer `a.id ===
 * cibleId` directement (ancien comportement pre-A.3) ferait TOUJOURS
 * echouer la recherche desormais, meme pour une cible parfaitement valide —
 * regression evitee ici, couverte par un test dedie.
 *
 * ADR-053 §16.13 (2026-08-06) : `referentielComplet` (6e parametre, defaut
 * `false`) distingue le cas ou la liste `cibles.postes` provient de la route
 * admin (toutes entrees, actives et inactives, reservee `PREVISIONS_PARAMETRER`)
 * de celui ou elle provient de la route actifs-seuls (`PREVISIONS_VOIR`).
 * Avec la liste complete, une cible absente est CERTAINEMENT introuvable
 * (`cibleIntrouvable`). Avec la liste partielle, une cible absente peut aussi
 * bien etre desactivee qu'inexistante — affirmer "introuvable" serait une
 * certitude fausse (ERR-173) : le libelle retourne alors `cibleEtatIndetermine`.
 * Ne concerne que la branche `POSTE_PREVISION` : un `AlimentPrevision` ne
 * porte aucune notion d'`actif`/desactivation.
 */
export function libelleCible(
  cibleType: CibleRapprochement,
  cibleId: string | null,
  cibles: CiblesDisponibles,
  translators: { tPrevisions: Translator; tStock: Translator },
  ciblesChargees = true,
  referentielComplet = false
): string | null {
  const { tPrevisions, tStock } = translators;
  if (!cibleId) return null;
  if (cibleType === CibleRapprochement.POSTE_PREVISION) {
    const poste = cibles.postes.find((p) => p.id === cibleId);
    if (poste) {
      if (poste.actif === false) return tPrevisions("rapprochementTab.mapping.cibleDesactivee");
      return poste.libelle;
    }
    if (!ciblesChargees) return tPrevisions("rapprochementTab.mapping.cibleNonChargee");
    return referentielComplet
      ? tPrevisions("rapprochementTab.mapping.cibleIntrouvable")
      : tPrevisions("rapprochementTab.mapping.cibleEtatIndetermine");
  }
  if (cibleType === CibleRapprochement.ALIMENT_PREVISION) {
    const tailleGranule = extraireTailleGranuleDeCibleId(cibleId);
    const aliment = tailleGranule ? cibles.aliments.find((a) => a.tailleGranule === tailleGranule) : undefined;
    if (aliment) return tStock(`produits.taillesGranule.${aliment.tailleGranule}`);
    return ciblesChargees
      ? tPrevisions("rapprochementTab.mapping.cibleIntrouvable")
      : tPrevisions("rapprochementTab.mapping.cibleNonChargee");
  }
  return null;
}

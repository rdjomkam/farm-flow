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
import { SourceRapprochement, CibleRapprochement } from "@/types";

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

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
  postes: Array<{ id: string; libelle: string }>;
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
 */
export function libelleCible(
  cibleType: CibleRapprochement,
  cibleId: string | null,
  cibles: CiblesDisponibles,
  translators: { tPrevisions: Translator; tStock: Translator },
  ciblesChargees = true
): string | null {
  const { tPrevisions, tStock } = translators;
  if (!cibleId) return null;
  if (cibleType === CibleRapprochement.POSTE_PREVISION) {
    const poste = cibles.postes.find((p) => p.id === cibleId);
    if (poste) return poste.libelle;
    return ciblesChargees
      ? tPrevisions("rapprochementTab.mapping.cibleIntrouvable")
      : tPrevisions("rapprochementTab.mapping.cibleNonChargee");
  }
  if (cibleType === CibleRapprochement.ALIMENT_PREVISION) {
    const aliment = cibles.aliments.find((a) => a.id === cibleId);
    if (aliment) return tStock(`produits.taillesGranule.${aliment.tailleGranule}`);
    return ciblesChargees
      ? tPrevisions("rapprochementTab.mapping.cibleIntrouvable")
      : tPrevisions("rapprochementTab.mapping.cibleNonChargee");
  }
  return null;
}

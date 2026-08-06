/**
 * src/lib/previsions/eligibilite.ts
 *
 * Previsions — eligibilite d'un Produit ALIMENT a la copie vers un scenario
 * (ADR-053 §18, story de selection explicite des produits).
 *
 * UN SEUL ENDROIT pour la regle "ce Produit ALIMENT est-il exploitable pour
 * une copie vers AlimentArticlePrevision ?" — reutilise tel quel par :
 *   1. GET /api/previsions/produits-alimentaires-eligibles (calcule `eligible`
 *      et `raisonsInvalidite` par produit avant de repondre) ;
 *   2. le garde serveur de POST /api/previsions/scenarios quand `produitIds`
 *      est fourni (rejette tout id dont ce predicat renvoie `eligible: false`,
 *      422 nommant le produit) ;
 *   3. les tests des deux routes ci-dessus.
 * Ne PAS redefinir cette regle une deuxieme fois cote route ou cote UI — la
 * duplication de cette regle est exactement le defaut d'origine documente en
 * ADR-053 §18 (deux disciplines opposees sur le meme champ logique selon la
 * porte d'entree).
 *
 * Deplacee depuis `src/types/api.ts` (review post-implementation) : un
 * fichier `types/` qui heberge une regle metier executable invite le
 * prochain developpeur a la redupliquer ailleurs plutot qu'a l'y chercher —
 * exactement la duplication que cette fonction existe pour eliminer. Ce
 * fichier vit dans `src/lib/previsions/`, le moteur de calcul pur du module
 * (zero I/O — pas de `prisma.*`, pas de `fs`, pas d'appel reseau), au meme
 * titre que les autres regles pures de ce dossier. Fonction pure et sans
 * dependance serveur : importable depuis un composant "use client"
 * (`src/components/previsions/scenario-form-dialog.tsx`).
 */

import { RaisonInvaliditeProduitPrevision, type TailleGranule } from "@/types/models";

/** Sous-ensemble de `Produit` necessaire pour evaluer l'eligibilite (§18). */
export interface ProduitAlimentaireEligibiliteInput {
  tailleGranule: TailleGranule | null;
  contenance: number | null;
}

/** Resultat de l'evaluation d'eligibilite — porte par le DTO de reponse. */
export interface EligibiliteProduitAlimentairePrevision {
  eligible: boolean;
  /**
   * Tableau, jamais un code unique : un Produit peut cumuler les deux
   * raisons (ni tailleGranule ni contenance exploitables) — un code unique
   * masquerait l'une des deux a l'utilisateur, qui devrait alors corriger,
   * re-soumettre, et decouvrir la seconde raison seulement au deuxieme
   * essai. Vide si `eligible === true`.
   */
  raisonsInvalidite: RaisonInvaliditeProduitPrevision[];
}

/**
 * Predicat pur — UNIQUE definition de la regle d'eligibilite (voir bandeau
 * ci-dessus). Deux conditions, chacune reportee independamment dans
 * `raisonsInvalidite` :
 *   - `tailleGranule` non nul (ADR-053 §12.2 arbitrage 5) ;
 *   - `contenance` strictement positive (aligne sur la contrainte de saisie
 *     manuelle `poidsSacKg: z.number().positive()`,
 *     `src/lib/validation/previsions.schema.ts` — jamais un 0 silencieux,
 *     ADR-053 §18).
 * Ne verifie PAS `categorie`/`isActive`/`siteId` : ce sont des criteres
 * D'APPARTENANCE A LA LISTE (filtre `where` de la requete appelante), pas
 * des criteres de QUALITE d'un produit deja dans la liste — les deux
 * familles ne doivent pas se meler dans le meme champ `raisonsInvalidite`
 * (un id hors site/hors categorie/inactif est un id invalide, rejete AVANT
 * d'atteindre ce predicat, jamais un "produit invalide" au sens de cette
 * fonction).
 */
export function evaluerEligibiliteProduitAlimentairePrevision(
  produit: ProduitAlimentaireEligibiliteInput
): EligibiliteProduitAlimentairePrevision {
  const raisonsInvalidite: RaisonInvaliditeProduitPrevision[] = [];

  if (!produit.tailleGranule) {
    raisonsInvalidite.push(RaisonInvaliditeProduitPrevision.TAILLE_GRANULE_MANQUANTE);
  }
  if (produit.contenance === null || produit.contenance <= 0) {
    raisonsInvalidite.push(RaisonInvaliditeProduitPrevision.CONTENANCE_MANQUANTE);
  }

  return { eligible: raisonsInvalidite.length === 0, raisonsInvalidite };
}

/**
 * src/lib/previsions-presentation/tresorerie-reelle-nette.ts
 *
 * Netting mensuel et cumule de la serie RÉEL de la vue tresorerie a trois
 * series (ADR-053 §6.4/§6.5 des exigences fonctionnelles, amendement §15.2,
 * §15.5, sprint PR3-ter, story B.1).
 *
 * PROBLEME RESOLU : `agregerParMois`/`agregerCumule`
 * (`src/lib/previsions/rapprochement.ts`) sonment `ligne.reel` ligne par
 * ligne SANS distinguer le signe DEPENSE/ENTREE — ce n'est pas un solde
 * net de tresorerie, c'est une somme de valeurs absolues qui grossit
 * artificiellement des qu'une DEPENSE et une ENTREE coexistent le meme
 * mois. Ce module ne modifie PAS `agregerParMois`/`agregerCumule` (utiles
 * pour d'autres vues du §6, ex. "top ecarts") — il ajoute une fonction
 * SOEUR, dediee au seul besoin "solde de tresorerie reel", en dehors du
 * moteur protege `src/lib/previsions/` (perimetre du sprint PR3-ter,
 * tranche explicitement par le PM : NE PAS toucher au moteur, creer un
 * module frere qui importe ses types en lecture seule).
 *
 * REGLES DE NETTING (ADR-053 §15.5, §15.1) :
 * - `natureGrandeur === "ENTREE"` -> `+reel` (une vente encaissee augmente
 *   la tresorerie).
 * - `natureGrandeur === "DEPENSE"` -> `-reel` (une depense decaissee
 *   diminue la tresorerie).
 * - `natureGrandeur === "QUANTITE"` -> EXCLUE du solde monetaire. Melanger
 *   des kg a des FCFA est precisement le defaut deja identifie ce sprint
 *   (story C2, "Total du mois" et "Top ecarts" melangent FCFA et kg sous
 *   un tri unique) — ce module ne le reproduit pas.
 * - `statutRapprochement === "SANS_SOURCE_REELLE"` -> EXCLUE (coherence
 *   ERR-173 : `reel` vaut structurellement `null` pour ce statut, jamais
 *   un `0` additif qui masquerait l'absence de source).
 * - `statutRapprochement === "NON_RAPPROCHE"` -> INCLUSE (une depense/
 *   entree reelle existe bel et bien, meme sans mapping — l'exclure du
 *   solde reel serait une disparition silencieuse, ADR-053 section 5).
 *
 * CAVEAT DES APPORTS (ADR-053 §15.1(b), §15.8(a)) : le domaine reel n'a
 * AUCUN modele pour les apports/subventions/prets reellement encaisses
 * (reporte sine die). Un solde reel construit par ce module est donc
 * STRUCTURELLEMENT INCOMPLET — biaise a la baisse des qu'un apport a
 * reellement ete encaisse mais n'apparait dans aucune `LigneRapprochement`
 * (aucune table domaine reel a lire pour ce cas). Ce caveat est porte
 * EXPLICITEMENT par le type de retour (`caveatApportsReelsNonModelises:
 * true`, litteral non filtrable) pour qu'aucun appelant ne puisse
 * presenter ce solde comme un total complet. L'affichage a l'ecran du
 * caveat est a la charge de la story B3 (UI) — ce module se contente de le
 * rendre impossible a ignorer cote contrat de fonction.
 *
 * Fonctions PURES, ZERO I/O — memes garanties que
 * `src/lib/previsions/rapprochement.ts` (section 15.6) : aucun `prisma.*`
 * ici, aucune ecriture, uniquement `LigneRapprochement[]` deja charge en
 * amont par la couche queries.
 */
import { Decimal } from "../previsions/decimal-config";
import type { LigneRapprochement } from "../previsions/types";

/**
 * Ligne de solde reel netté, mensuelle OU cumulee selon la fonction
 * appelante (`netterTresorerieReelleParMois`/`netterTresorerieReelleCumulee`).
 */
export interface SoldeReelNette {
  moisAbsolu: number;
  /**
   * Solde net FCFA (ENTREE positive, DEPENSE negative), EXCLUT QUANTITE et
   * SANS_SOURCE_REELLE. Pour `netterTresorerieReelleParMois` : solde de ce
   * seul mois. Pour `netterTresorerieReelleCumulee` : solde cumule depuis
   * le premier mois present jusqu'a `moisAbsolu` inclus.
   */
  soldeNetFCFA: Decimal;
  /**
   * Caveat non filtrable (ADR-053 §15.1(b)) : ce solde EXCLUT
   * structurellement tout apport/subvention/pret reellement encaisse — le
   * domaine reel n'a aucune table pour cette donnee. Toujours `true` ; sa
   * seule fonction est d'empecher un appelant de traiter ce type comme un
   * solde reel "complet" sans lire ce champ.
   */
  caveatApportsReelsNonModelises: true;
}

/** Signe applique au netting selon la nature de la grandeur (ADR-053 §15.5). */
function signePourNetting(l: LigneRapprochement): 1 | -1 | 0 {
  if (l.natureGrandeur === "QUANTITE") return 0; // exclue du solde monetaire
  if (l.statutRapprochement === "SANS_SOURCE_REELLE") return 0; // reel === null, jamais additionne
  if (l.natureGrandeur === "ENTREE") return 1;
  return -1; // DEPENSE
}

/** Solde net (signe applique) d'UNE ligne, ou `null` si la ligne est exclue du netting. */
function soldeNetDeLigne(l: LigneRapprochement): Decimal | null {
  const signe = signePourNetting(l);
  if (signe === 0) return null;
  // signe !== 0 implique statutRapprochement !== "SANS_SOURCE_REELLE", donc
  // l.reel n'est jamais null a ce point (garantie construireLigneRapprochement).
  return (l.reel as Decimal).times(signe);
}

/**
 * Nette les lignes de rapprochement MOIS PAR MOIS (ADR-053 §6.4/§6.5,
 * story B.1). Une ligne est incluse dans la somme du mois uniquement si sa
 * `natureGrandeur` n'est pas `QUANTITE` et son `statutRapprochement`
 * n'est pas `SANS_SOURCE_REELLE`.
 *
 * Trie par `moisAbsolu` croissant. Seuls les mois presents dans `lignes`
 * apparaissent dans le resultat (meme convention que
 * `src/lib/previsions/rapprochement.ts#agregerParMois`) — a l'appelant
 * d'inserer les mois absents a 0 si l'horizon complet doit etre affiche.
 */
export function netterTresorerieReelleParMois(lignes: LigneRapprochement[]): SoldeReelNette[] {
  const parMois = new Map<number, Decimal>();

  for (const l of lignes) {
    const delta = soldeNetDeLigne(l);
    if (delta === null) continue;
    const courant = parMois.get(l.moisAbsolu) ?? new Decimal(0);
    parMois.set(l.moisAbsolu, courant.plus(delta));
  }

  return Array.from(parMois.entries())
    .sort(([a], [b]) => a - b)
    .map(([moisAbsolu, soldeNetFCFA]) => ({
      moisAbsolu,
      soldeNetFCFA,
      caveatApportsReelsNonModelises: true as const,
    }));
}

/**
 * Nette les lignes de rapprochement CUMULATIVEMENT (ADR-053 §6.4/§6.5,
 * story B.1) : pour chaque mois present, le solde cumule depuis le
 * premier mois present jusqu'a ce mois inclus.
 *
 * Construite en reutilisant `netterTresorerieReelleParMois` (jamais une
 * reimplementation locale du netting, ERR-171) puis en cumulant les
 * deltas mensuels dans l'ordre croissant — le cumul n'est PAS une simple
 * somme globale des lignes filtrees par mois (ce qui omettrait les mois
 * SANS aucune ligne reelle entre deux mois avec donnees, cassant la
 * continuite d'une courbe cumulee) : chaque mois present porte la somme
 * de tous les deltas mensuels des mois <= lui, y compris ceux de mois qui
 * n'apparaitraient pas eux-memes dans le resultat s'ils n'avaient aucune
 * ligne — ce cas ne peut pas survenir ici par construction (un mois
 * n'existe dans `netterTresorerieReelleParMois` que s'il a au moins une
 * ligne nettable), mais la boucle ci-dessous reste correcte y compris si
 * un mois intermediaire est absent : son delta est implicitement 0.
 */
export function netterTresorerieReelleCumulee(lignes: LigneRapprochement[]): SoldeReelNette[] {
  const parMois = netterTresorerieReelleParMois(lignes);

  let cumul = new Decimal(0);
  return parMois.map(({ moisAbsolu, soldeNetFCFA }) => {
    cumul = cumul.plus(soldeNetFCFA);
    return {
      moisAbsolu,
      soldeNetFCFA: cumul,
      caveatApportsReelsNonModelises: true as const,
    };
  });
}

"use client";

/**
 * src/components/previsions/previsions-mensuelles-tab.tsx
 *
 * Vue Prevision mensuelle (Sprint PR2, story PR2.4, mise en forme corrigee
 * post-livraison) : tableau indicateurs x mois.
 *
 * Correctif post-livraison (decision utilisateur explicite, priment sur le
 * §7.4 des exigences) : le §7.4 autorisait ce grand tableau a "rester
 * reserve au bureau", et une premiere version affichait donc sous 768px une
 * carte empilee d'UN mois a la fois, navigable par boutons precedent/suivant
 * (rompant au passage la regle projet "pas de tableau sur mobile"). Retour
 * utilisateur explicite : cette navigation par clics empeche precisement ce
 * qu'il cherche — "voir tout d'un coup d'oeil en glissant, sans cliquer".
 * Decision : LE MEME tableau (memes lignes, memes colonnes, meme markup) est
 * desormais servi a TOUTES les tailles d'ecran ; c'est le defilement
 * horizontal DANS le conteneur du tableau (jamais la page) qui porte la
 * navigation entre mois, a 375px comme a 1280px. La vue carte par mois et ses
 * boutons precedent/suivant ont ete entierement supprimes (composant, cles
 * i18n `prevMonth`/`nextMonth` de ce namespace, et l'etat React `moisIndex`
 * qui les pilotait).
 *
 * Orientation (correctif post-livraison, constat utilisateur) : le classeur
 * Excel de reference intitule sa feuille "indicateurs en lignes, mois en
 * colonnes" (Annexe A, "tableau central mois x indicateurs") — et c'est la
 * seule orientation praticable avec 21 mois et ~8 indicateurs : on lit une
 * serie temporelle de gauche a droite, pas de haut en bas. Le tableau est
 * donc UNE LIGNE PAR INDICATEUR, UNE COLONNE PAR MOIS, plus une colonne
 * TOTAL de fin de ligne, comme dans le classeur.
 *
 * Colonne Total et lignes cumulatives (bugfix PR2q.1) : la colonne Total
 * n'est une somme des mois QUE pour les lignes de flux (revenus, couts,
 * depenses, apports...). Pour une ligne CUMULATIVE (aujourd'hui : "Solde
 * cumule"), sommer les 21 valeurs mensuelles compterait chaque mois
 * plusieurs fois puisque chaque valeur inclut deja les mois precedents —
 * le classeur de reference confirme que `Previsions!W35` (Total de "Solde
 * cumule") vaut `=V35` (la valeur du dernier mois), jamais une somme. Voir
 * le type `TotalMode` et `calculerTotalLigne` ci-dessous : chaque ligne
 * declare explicitement son mode d'agregation ("somme" | "derniereValeur").
 *
 * Confinement du defilement horizontal (correctif post-livraison) : le
 * tableau defile DANS SON PROPRE CONTENEUR (`overflow-x-auto` sur le
 * wrapper local), jamais la page entiere — cf. `overflow-x-clip` deja pose
 * sur les conteneurs flex de `app-shell.tsx`. La premiere colonne
 * (libelle de l'indicateur) est rendue collante (`sticky left-0`) pour que
 * l'utilisateur ne perde jamais de vue ce qu'il lit des le troisieme mois.
 *
 * En-tete de section collant (correctif post-livraison, campagne de rendu
 * reel Chromium PR2-quinquies, scenario EXCEL-V12) : la ligne d'en-tete de
 * chaque section utilisait un UNIQUE `<td colSpan={mois.length + 2}>` en
 * `sticky left-0` — mais `position: sticky` epingle une cellule PAR RAPPORT
 * A SON PROPRE CONTENU, jamais au-dela. Comme cette cellule s'etalait sur
 * TOUTE la largeur du tableau (colSpan couvrant indicateur + tous les mois +
 * total), elle etait deja son propre conteneur : le "sticky" n'avait aucune
 * marge pour epingler quoi que ce soit, et le titre disparaissait hors-ecran
 * des que l'utilisateur defilait horizontalement (mesure : a `scrollLeft`
 * maximum, le titre se trouvait a 1595px hors champ). Fix : le meme
 * mecanisme qui fonctionne deja pour les lignes d'indicateurs (une cellule
 * `sticky left-0` etroite, de la largeur de la seule colonne des libelles,
 * suivie d'une cellule `colSpan` NON collante qui sert de bande de fond) —
 * jamais un mecanisme parallele. La cellule collante utilise `bg-muted`
 * (opaque, variable de theme R6) plutot que `bg-muted/60` : une cellule
 * collante semi-transparente laisserait apparaitre en filigrane le contenu
 * des colonnes de mois qui defilent dessous.
 *
 * Unite hors cellule (correctif post-livraison) : "FCFA" n'est plus repete
 * dans chacune des 8 x 21 cellules (ce qui doublait la hauteur de chaque
 * rangee) — il figure une seule fois, entre parentheses, dans le libelle de
 * chaque ligne d'indicateur ("Coût aliments (FCFA)"), jamais dans les
 * en-tetes de mois. `formatMontantPrevision(..., "fr", false)` est utilise
 * pour les cellules (sans suffixe), l'unite etant deja portee par la ligne.
 *
 * Tableau unique a toutes les tailles (correctif post-livraison, retour
 * utilisateur, remplace la carte mobile ci-dessus) :
 * - Colonne collante retrecie sous 768px (`w-28`/`max-w-28`, contre `w-56`
 *   a partir de `md:`) : a 375px, une colonne de largeur desktop mangerait
 *   une part disproportionnee des ~350px utiles. Le libelle est tronque
 *   (`truncate` sur un `<span>` interne, jamais sur la cellule elle-meme qui
 *   doit rester un conteneur flex pour aligner libelle + bouton
 *   d'explication) et l'attribut `title` porte le libelle COMPLET — la
 *   meme cellule sert donc pour les en-tetes de section (bouton) et les
 *   lignes de donnees (span), avec le meme jeu de classes de largeur pour
 *   que les deux s'alignent verticalement en une seule colonne visuelle.
 * - `overscroll-x-contain` sur le conteneur scrollable : un balayage
 *   horizontal qui atteint le bord du tableau ne doit jamais "deborder" sur
 *   le geste de navigation precedente/suivante du navigateur (Safari/Chrome
 *   mobile interpretent un scroll horizontal qui chaine jusqu'au document
 *   comme un balayage de navigation) — `overscroll-behavior-x: contain`
 *   arrete la chaine de defilement a la limite du conteneur. `touch-pan-x`
 *   documente explicitement au moteur de rendu que ce conteneur gere son
 *   propre defilement horizontal au doigt.
 * - Indicateur discret de contenu hors ecran (item 4 de la demande
 *   utilisateur, "rien ne signale qu'on peut glisser") : DEUX signaux
 *   complementaires plutot qu'un seul, choisis parce qu'aucun des deux ne
 *   depend de l'etat de scroll (donc aucun JS de suivi de `scrollLeft`,
 *   aucune garantie qui se degraderait silencieusement si ce JS echouait) —
 *   (1) une ombre portee permanente sur le bord droit de la colonne
 *   collante (`shadow-[...]`), qui donne a la colonne un relief de "volet
 *   flottant au-dessus d'un contenu qui continue derriere elle" ; (2) un
 *   degrade `pointer-events-none` sur le bord droit du conteneur
 *   (`bg-gradient-to-l from-[var(--card)]`), qui suggere visuellement que
 *   le contenu continue au-dela du cadre visible. Alternative ecartee : un
 *   indicateur qui n'apparait qu'en debut de defilement et disparait au
 *   bord — plus fidele mais necessite de suivre `scrollLeft` en JS, un
 *   couplage juge disproportionne pour un simple signal d'affordance (cf.
 *   ERR-157 : toute garantie visuelle supplementaire ajoute un point que
 *   jsdom ne peut pas verifier, donc a verifier en navigateur reel — voir
 *   le rapport de verification EXCEL-V12 en fin de story).
 *
 * Story PR2q.3 — 30 lignes du classeur (8 exposees avant cette story) :
 * regroupement obligatoire (§7.1, "comprendre sa situation en moins de 10
 * secondes") en 4 sections repliables (Radix Collapsible, meme patron que
 * `vague-bacs-section.tsx`) : "Résultat" (dépliée par defaut), "Production",
 * "Aliments", "Entrées & dépenses détaillées" (repliées par defaut). Chaque
 * ligne declare desormais, en plus de `totalMode` (deja existant), un
 * `format` ("montant" | "tonnage" | "entier") consomme UNIFORMEMENT par
 * `formatLigne()` — aucune branche par nom de ligne dans le rendu, meme
 * discipline que `calculerTotalLigne()`. Les 3 lignes "dont sacs Xmm" (8-10
 * du classeur) sont construites DYNAMIQUEMENT depuis les cles reellement
 * presentes dans `MoisProjectionDTO.sacsParGranulometrie` (jamais 3 lignes
 * codees en dur "2mm/3mm/4mm") — un scenario de production peut utiliser
 * n'importe laquelle des 9 valeurs de `TailleGranule`, pas seulement les 3
 * du jeu d'or.
 *
 * Story PR2q.4 — ventilations "au-dela du classeur" : une 5e section
 * "Ventilations" (repliee par defaut, meme raison que les 3 autres
 * repliees) ajoute la ventilation des apports par type
 * (`TypeApportCapital` — 2 lignes fixes) et des depenses par poste
 * (`PostePrevision` individuel, JAMAIS `TypePostePrevision` — 2 valeurs
 * seulement, bien trop grossier pour ce que l'utilisateur appelle "poste").
 * Nombre de lignes de poste VARIABLE selon le scenario (construites
 * dynamiquement, meme patron que les lignes "dont sacs Xmm" ci-dessus).
 * Toute la logique de ventilation est dans `src/lib/previsions/ventilations.ts`
 * (pure, testee independamment) — ce composant se contente de l'appeler et
 * d'en afficher le resultat, jamais de la reimplementer inline (ERR-153).
 */
import { Fragment, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  formatMontantPrevision,
  formatEntierPrevision,
  formatTonnagePrevision,
  classeMontant,
} from "@/lib/previsions/format-previsions";
import { libelleMoisCalendaire } from "@/lib/previsions/tableau-de-bord-helpers";
import { ventilerApportsParType, ventilerDepensesParPoste } from "@/lib/previsions/ventilations";
import type { MoisProjectionDTO } from "@/components/previsions/projection-types";
import type {
  ApportCapitalDTO,
  ChargeMensuellePrevueDTO,
  PostePrevisionDTO,
  JournalDepensePrevueDTO,
} from "@/components/previsions/api-types";
import { TypeApportCapital } from "@/types";
import { cn } from "@/lib/utils";
import { suffixeCompactRattachement } from "@/components/previsions/poste-rattachement-badge";

interface PrevisionsMensuellesTabProps {
  dateDebutPlan: string;
  mois: MoisProjectionDTO[];
  /**
   * Message d'erreur reel si le calcul de la projection a echoue (ex.
   * configuration manquante) — distinct de l'etat "scenario reellement
   * vide". Cf. finding de review PR2.4.
   */
  erreurProjection: string | null;
  /**
   * Story PR2q.4 — "au-dela du classeur" : donnees BRUTES (deja chargees par
   * `ScenarioDetailClient`, jamais une nouvelle requete) utilisees UNIQUEMENT
   * pour ventiler par type d'apport et par poste de charge, en section
   * "Ventilations" (repliee par defaut). Aucune de ces 4 listes ne remplace
   * ni ne recalcule une grandeur agregee du moteur (`mois[]` reste la seule
   * source des lignes "Apports (FCFA)" / "Charges reparties (FCFA)") — voir
   * `src/lib/previsions/ventilations.ts` pour la garantie
   * "total ventile = ligne agregee".
   */
  apports: ApportCapitalDTO[];
  charges: ChargeMensuellePrevueDTO[];
  postes: PostePrevisionDTO[];
  journal: JournalDepensePrevueDTO[];
}

/**
 * Explicabilite §7.4 pour ce tableau : envelopper chacune des N x 21
 * cellules dans un `ValeurCalculee` individuel (Popover par cellule)
 * alourdirait fortement l'ecran pour une redondance totale — la FORMULE
 * d'un indicateur est la meme pour tous les mois, seules les VALEURS
 * SOURCES changent d'un mois a l'autre (et ces valeurs sources elles-memes,
 * sacs/couts par vague, sont deja explicables ailleurs : onglets
 * Granulometries, Charges, Journal). Alternative retenue : une explication
 * PAR LIGNE, portee par le libelle de chaque ligne d'indicateur (desktop,
 * en-tete de ligne collant) et par le libelle de chaque ligne de la carte
 * mobile — l'utilisateur comprend la formule qui produit CE chiffre sans
 * qu'elle soit repetee 21 fois par ligne. Chaque NOUVELLE ligne de la story
 * PR2q.3 suit la meme regle, y compris les lignes dynamiques "dont sacs
 * Xmm".
 */
/**
 * Mode d'agregation de la colonne Total d'une ligne du tableau.
 *
 * - "somme" : les 21 valeurs mensuelles s'additionnent (revenus, couts,
 *   depenses, apports, etc. — des flux du mois, independants les uns des
 *   autres).
 * - "derniereValeur" : la colonne Total vaut la DERNIERE valeur mensuelle
 *   non vide de la ligne, jamais une somme. C'est le cas de toute ligne
 *   CUMULATIVE (ex. solde/tresorerie cumule(e)) : chaque valeur mensuelle
 *   inclut deja tous les mois precedents, donc sommer les 21 valeurs
 *   compterait chaque mois plusieurs fois. Reference verifiee dans le
 *   classeur Excel : `Previsions!W35` (colonne Total de "Solde cumule")
 *   vaut `=V35`, la valeur du dernier mois, pas `=SUM(...)`.
 *
 * Story PR2q.3 : "Résultat du mois" totalise egalement par SOMME (pas un
 * 3e mode `"aucun"`) — le total cumule ainsi obtenu EST une vraie donnee
 * du jeu d'or (`cumuls.resultatCumule`), pas une grandeur sans sens.
 */
type TotalMode = "somme" | "derniereValeur";

/**
 * Largeur de la colonne collante (libelle d'indicateur / titre de section),
 * PARTAGEE entre l'en-tete, les titres de section et les lignes de donnees
 * pour que les 3 s'alignent en une seule colonne visuelle. Retrecie sous
 * `md:` (375px : une colonne pleine largeur desktop y mangerait une part
 * disproportionnee de l'espace utile) — voir doc d'en-tete du fichier,
 * section "Tableau unique a toutes les tailles".
 */
const COLONNE_INDICATEUR_CLASSES = "w-28 max-w-28 sm:w-40 sm:max-w-40 md:w-56 md:max-w-56";

/** Format d'affichage d'une ligne (§7.4) — declare une fois par ligne, jamais devine par nom de champ. */
type LigneFormat = "montant" | "tonnage" | "entier";

interface LigneDescriptor {
  id: string;
  /** Accesseur sur un mois — permet des lignes DERIVEES (ex. "Total des entrées") sans champ dedie sur le DTO. */
  accessor: (m: MoisProjectionDTO) => number;
  totalMode: TotalMode;
  format: LigneFormat;
  label: string;
  formule: string;
}

/**
 * Story PR2sex.3 — sous-section repliable nichee sous une `SectionDescriptor`
 * (ex. "Détail par mois de cycle" sous "Aliments"). Type frere minimal de
 * `SectionDescriptor` : pas de `defaultOpen` (toujours repliee par defaut a
 * ce jour, aucun besoin identifie d'un sous-groupe deploye au premier
 * ecran — voir pre-analyse §2). La cle composee `${section.id}.${groupe.id}`
 * dans `sectionsOuvertes` evite tout etat imbrique.
 */
interface SousSectionDescriptor {
  id: string;
  title: string;
  lignes: LigneDescriptor[];
}

interface SectionDescriptor {
  id: string;
  title: string;
  defaultOpen: boolean;
  lignes: LigneDescriptor[];
  /** Story PR2sex.3 — sous-groupes optionnels, rendus APRES les `lignes` plates de la section. */
  groupes?: SousSectionDescriptor[];
}

/**
 * Calcule la colonne Total d'une ligne selon son `totalMode` : une somme
 * des valeurs mensuelles, ou la derniere valeur mensuelle pour une ligne
 * cumulative (cf. doc `TotalMode` ci-dessus).
 */
function calculerTotalLigne(moisListe: MoisProjectionDTO[], ligne: LigneDescriptor): number {
  if (moisListe.length === 0) return 0;
  if (ligne.totalMode === "derniereValeur") {
    return ligne.accessor(moisListe[moisListe.length - 1]);
  }
  return moisListe.reduce((acc, m) => acc + ligne.accessor(m), 0);
}

/** Formate une valeur selon le `format` declare par la ligne — jamais une branche par nom de ligne (§7.4). */
function formatLigne(valeur: number, format: LigneFormat, avecUnite: boolean): string {
  switch (format) {
    case "montant":
      return formatMontantPrevision(valeur, "fr", avecUnite);
    case "tonnage":
      return formatTonnagePrevision(valeur, "fr");
    case "entier":
      return formatEntierPrevision(valeur, "fr");
    default:
      return formatMontantPrevision(valeur, "fr", avecUnite);
  }
}

/**
 * En-tete de section/sous-section repliable — motif a 2 cellules extrait
 * (story PR2sex.3, ERR-157/ERR-158) : une cellule collante ETROITE (largeur
 * exacte de la colonne des libelles, fond OPAQUE `bg-muted`) qui porte le
 * bouton, suivie d'une bande `colSpan` non collante en `aria-hidden`. Un
 * unique `<td colSpan>` en `sticky` n'a aucune marge ou s'epingler et
 * disparait hors ecran au defilement (ERR-157) — ne JAMAIS reimplementer ce
 * motif ad hoc, toujours passer par ce composant, pour le niveau section
 * COMME pour le niveau sous-section.
 */
function EnTeteRepliable({
  title,
  ouvert,
  onToggle,
  nbColonnesRestantes,
}: {
  title: string;
  ouvert: boolean;
  onToggle: () => void;
  /** `mois.length + 1` (les mois + la colonne Total) — largeur de la bande de fond non collante. */
  nbColonnesRestantes: number;
}) {
  return (
    <tr className="border-b border-border bg-muted/60">
      <td
        className={cn(
          "sticky left-0 z-10 border-r border-border bg-muted px-2 py-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] sm:px-3",
          COLONNE_INDICATEUR_CLASSES
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouvert}
          title={title}
          className="flex w-full items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ouvert ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{title}</span>
        </button>
      </td>
      <td colSpan={nbColonnesRestantes} className="bg-muted/60 px-2 py-1.5 sm:px-3" aria-hidden="true" />
    </tr>
  );
}

/** Bouton d'explication compact pour un en-tete de ligne / libelle de carte (pas de valeur associee, contrairement a `ValeurCalculee`). */
function ExplicationLigne({ formule, ariaLabel }: { formule: string; ariaLabel: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Calculator className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm text-foreground">{formule}</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Ligne de donnee du tableau — extraite (story PR2sex.3) pour etre partagee
 * entre les `lignes` plates d'une section ET les `lignes` d'une sous-section
 * (`SousSectionDescriptor.lignes`), aucune divergence de rendu de cellule
 * entre les deux niveaux.
 */
function LigneRow({
  ligne: l,
  mois,
  t,
}: {
  ligne: LigneDescriptor;
  mois: MoisProjectionDTO[];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const total = calculerTotalLigne(mois, l);
  return (
    <tr className="border-b border-border/60 hover:bg-muted/40">
      <td
        title={l.label}
        className={cn(
          "sticky left-0 z-10 border-r border-border bg-card px-2 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] sm:px-3",
          COLONNE_INDICATEUR_CLASSES
        )}
      >
        <span className="inline-flex w-full items-center gap-1">
          <span className="truncate">{l.label}</span>
          <ExplicationLigne formule={l.formule} ariaLabel={t("previsionsMensuellesTab.rowAria", { label: l.label })} />
        </span>
      </td>
      {mois.map((m) => {
        const n = l.accessor(m);
        return (
          <td key={m.moisAbsolu} className={cn("px-2 py-2 text-right tabular-nums sm:px-3", classeMontant(n))}>
            {formatLigne(n, l.format, false)}
          </td>
        );
      })}
      <td className={cn("px-2 py-2 text-right font-semibold tabular-nums sm:px-3", classeMontant(total))}>
        {formatLigne(total, l.format, false)}
      </td>
    </tr>
  );
}

export function PrevisionsMensuellesTab({
  dateDebutPlan,
  mois,
  erreurProjection,
  apports,
  charges,
  postes,
  journal,
}: PrevisionsMensuellesTabProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  // Memoise (story PR2q.4) : `new Date(...)` recree une reference a chaque
  // rendu — sans memoisation, les `useMemo` de ventilation ci-dessous
  // (dependants de `dateDebut`) recalculeraient a chaque rendu, perdant
  // toute leur utilite.
  const dateDebut = useMemo(() => new Date(dateDebutPlan), [dateDebutPlan]);
  const [sectionsOuvertes, setSectionsOuvertes] = useState<Record<string, boolean>>({
    resultat: true,
    production: false,
    aliments: false,
    "aliments.detailParVague": false,
    entreesDepenses: false,
    ventilations: false,
  });

  /**
   * Granulometries reellement presentes (`sacsParGranulometrie`, UNION des
   * cles sur tous les mois, ordre de premiere apparition = ordre du scenario,
   * GAP 2 de `route-orchestration.ts`) — source unique reutilisee par
   * `lignesGranulometrie` ET `lignesDetailParVague` (story PR2sex.3), jamais
   * un second referentiel de granulometrie.
   */
  const granulesVus = useMemo<string[]>(() => {
    const vus: string[] = [];
    for (const m of mois) {
      for (const g of Object.keys(m.sacsParGranulometrie)) {
        if (!vus.includes(g)) vus.push(g);
      }
    }
    return vus;
  }, [mois]);

  /**
   * Lignes "dont sacs Xmm" (8-10 du classeur) — construites dynamiquement
   * depuis `granulesVus`. Jamais 3 lignes codees en dur.
   */
  const lignesGranulometrie = useMemo<LigneDescriptor[]>(() => {
    return granulesVus.map((g) => {
      const libelleGranule = tStock(`produits.taillesGranule.${g}`);
      return {
        id: `sacsGranulometrie-${g}`,
        accessor: (m: MoisProjectionDTO) => m.sacsParGranulometrie[g] ?? 0,
        totalMode: "somme" as TotalMode,
        format: "entier" as LigneFormat,
        label: t("previsionsMensuellesTab.rows.sacsGranulometrie.label", { granule: libelleGranule }),
        formule: t("previsionsMensuellesTab.rows.sacsGranulometrie.formule", { granule: libelleGranule }),
      };
    });
  }, [granulesVus, t, tStock]);

  /**
   * Story PR2sex.3 — "Détail par mois de cycle" (sous-section repliee par
   * defaut sous "Aliments") : 9 (ou N) lignes = positions de cycle
   * REELLEMENT PRESENTES dans `detailParVagueSacs` (jamais 1..3 code en dur,
   * le cycle est parametrable, ADR-053 §12.5) x granulometries reellement
   * presentes (memes `granulesVus` que ci-dessus, completees par toute cle
   * additionnelle qui n'apparaitrait QUE dans `detailParVagueSacs`), dans
   * l'ordre du classeur : position croissante, puis granulometrie dans
   * l'ordre deja utilise par `lignesGranulometrie`.
   *
   * Distinction semantique imperative avec les lignes "dont sacs Xmm"
   * ci-dessus : celles-ci sont des sacs A ACHETER (arrondi PAR EXCES, ceil),
   * CES lignes-ci sont des sacs CONSOMMES (ROUND), indicatif — jamais une
   * base de commande. Le libelle ET la formule (bouton d'explication)
   * portent explicitement cette distinction (i18n, voir
   * `rows.detailSacsParVague`).
   */
  const detailPositionsEtGranules = useMemo(() => {
    const positionsVues = new Set<number>();
    const granulesDetail: string[] = [...granulesVus];
    for (const m of mois) {
      for (const posStr of Object.keys(m.detailParVagueSacs)) {
        const pos = Number(posStr);
        positionsVues.add(pos);
        for (const g of Object.keys(m.detailParVagueSacs[pos] ?? {})) {
          if (!granulesDetail.includes(g)) granulesDetail.push(g);
        }
      }
    }
    return {
      positions: Array.from(positionsVues).sort((a, b) => a - b),
      granules: granulesDetail,
    };
  }, [mois, granulesVus]);

  const lignesDetailParVague = useMemo<LigneDescriptor[]>(() => {
    const { positions, granules } = detailPositionsEtGranules;
    const lignes: LigneDescriptor[] = [];
    for (const pos of positions) {
      for (const g of granules) {
        const libelleGranule = tStock(`produits.taillesGranule.${g}`);
        lignes.push({
          id: `detailSacsParVague-${pos}-${g}`,
          accessor: (m: MoisProjectionDTO) => m.detailParVagueSacs[pos]?.[g] ?? 0,
          totalMode: "somme" as TotalMode,
          format: "entier" as LigneFormat,
          label: t("previsionsMensuellesTab.rows.detailSacsParVague.label", { granule: libelleGranule, count: pos }),
          formule: t("previsionsMensuellesTab.rows.detailSacsParVague.formule", { granule: libelleGranule, count: pos }),
        });
      }
    }
    return lignes;
  }, [detailPositionsEtGranules, t, tStock]);

  /**
   * Story PR2q.4 — ventilation des apports par type (`TypeApportCapital`) et
   * des depenses par poste (`PostePrevision`), demandee "au-dela du
   * classeur". Reutilise `src/lib/previsions/ventilations.ts` (pure,
   * testee : `somme(ventilation) === ligne agregee` du moteur) — ce
   * composant ne recalcule rien lui-meme, il APPELLE ces fonctions et lit
   * leur resultat (meme discipline que `calculerTotalLigne`/`formatLigne`,
   * cf. ERR-153).
   */
  const ventilationApports = useMemo(
    () => ventilerApportsParType(apports, dateDebut),
    [apports, dateDebut]
  );
  const ventilationDepenses = useMemo(
    () =>
      ventilerDepensesParPoste(
        charges,
        [...postes].sort((a, b) => a.ordre - b.ordre),
        journal,
        dateDebut
      ),
    [charges, postes, journal, dateDebut]
  );

  /**
   * Lignes "Apports — {type}" — toujours les 2 (CAPITAL, CREDIT ; enum a 2
   * valeurs fixes, R2 : jamais une chaine en dur), meme si l'un des 2 est
   * nul sur ce scenario — l'utilisateur voit alors "–" (§7.4), pas une
   * ligne qui disparait selon les donnees.
   */
  const lignesApportsParType = useMemo<LigneDescriptor[]>(() => {
    const types = [TypeApportCapital.CAPITAL, TypeApportCapital.CREDIT];
    return types.map((type) => {
      const libelleType = t(`apportsTab.types.${type}`);
      return {
        id: `apportParType-${type}`,
        accessor: (m: MoisProjectionDTO) => ventilationApports[type]?.get(m.moisAbsolu) ?? 0,
        totalMode: "somme" as TotalMode,
        format: "montant" as LigneFormat,
        label: t("previsionsMensuellesTab.rows.apportParType.label", { type: libelleType }),
        formule: t("previsionsMensuellesTab.rows.apportParType.formule", { type: libelleType }),
      };
    });
  }, [t, ventilationApports]);

  /**
   * Lignes "Dépenses — {poste}" — UNE par `PostePrevision` avec
   * `inclusBaseRepartition = true` (jamais par `TypePostePrevision`, piege
   * 2 de la pre-analyse PR2q.4 : 2 valeurs seulement, bien trop grossier).
   * Nombre VARIABLE selon le scenario (0 a N postes) — c'est precisement
   * pourquoi cette ligne appartient a la section "Ventilations", repliee
   * par defaut (§7.1 : jamais depliee au premier ecran, y compris pour un
   * scenario a 10 postes).
   */
  const lignesDepensesParPoste = useMemo<LigneDescriptor[]>(() => {
    return ventilationDepenses.parPoste.map((p) => {
      // ADR-053 §16.12, exigence A : suffixe compact "(réf. …)" quand le
      // libelle scenario-local diverge du referentiel, ou "(réf. désactivé)"
      // si l'entree referentiel est desactivee — jamais dans le moteur pur
      // (ventilationDepenses), toujours en presentation.
      const poste = postes.find((candidat) => candidat.id === p.posteId);
      const suffixe =
        poste && poste.posteReferentiel ? suffixeCompactRattachement(t, p.libelle, poste.posteReferentiel) : null;
      const libelleAffiche = suffixe ? `${p.libelle} (${suffixe})` : p.libelle;
      return {
        id: `depenseParPoste-${p.posteId}`,
        accessor: (m: MoisProjectionDTO) => p.parMois.get(m.moisAbsolu) ?? 0,
        totalMode: "somme" as TotalMode,
        format: "montant" as LigneFormat,
        label: t("previsionsMensuellesTab.rows.depenseParPoste.label", { poste: libelleAffiche }),
        formule: t("previsionsMensuellesTab.rows.depenseParPoste.formule", { poste: libelleAffiche }),
      };
    });
  }, [t, ventilationDepenses, postes]);

  const SECTIONS = useMemo<SectionDescriptor[]>(() => {
    const ligne = (
      key: keyof MoisProjectionDTO | null,
      i18nKey: string,
      totalMode: TotalMode,
      format: LigneFormat,
      accessor?: (m: MoisProjectionDTO) => number
    ): LigneDescriptor => ({
      id: i18nKey,
      accessor: accessor ?? ((m: MoisProjectionDTO) => (typeof m[key!] === "number" ? (m[key!] as number) : 0)),
      totalMode,
      format,
      label: t(`previsionsMensuellesTab.rows.${i18nKey}.label`),
      formule: t(`previsionsMensuellesTab.rows.${i18nKey}.formule`),
    });

    return [
      {
        id: "resultat",
        title: t("previsionsMensuellesTab.sections.resultat"),
        defaultOpen: true,
        lignes: [
          // Ligne 27 — derivee cote UI (revenusFCFA + apportsFCFA), aucun champ dedie sur le moteur/DTO.
          ligne(null, "totalEntrees", "somme", "montant", (m) => m.revenusFCFA + m.apportsFCFA),
          ligne("depensesFCFA", "depensesTotales", "somme", "montant"),
          ligne("resultatFCFA", "resultatMois", "somme", "montant"),
          ligne("soldeFCFA", "soldeCumule", "derniereValeur", "montant"),
        ],
      },
      {
        id: "production",
        title: t("previsionsMensuellesTab.sections.production"),
        defaultOpen: false,
        lignes: [
          ligne("empoissonneKg", "empoissonne", "somme", "tonnage"),
          ligne("ventesKg", "ventes", "somme", "tonnage"),
          ligne("alevinsACommanderNb", "alevinsCommander", "somme", "entier"),
        ],
      },
      {
        id: "aliments",
        title: t("previsionsMensuellesTab.sections.aliments"),
        defaultOpen: false,
        lignes: [
          ligne("besoinAlimentsTotalKg", "besoinAliments", "somme", "entier"),
          ligne("sacsAlimentsTotal", "sacsAchat", "somme", "entier"),
          ...lignesGranulometrie,
        ],
        // Story PR2sex.3 — sous-section repliee par defaut, isole le detail
        // "consomme, indicatif" (9 lignes ou plus) du reste de la section
        // "Aliments" (qui porte les grandeurs "a acheter") — voir pre-analyse §2, option (a).
        groupes: [
          {
            id: "detailParVague",
            title: t("previsionsMensuellesTab.sections.detailParVague"),
            lignes: lignesDetailParVague,
          },
        ],
      },
      {
        id: "entreesDepenses",
        title: t("previsionsMensuellesTab.sections.entreesDepenses"),
        defaultOpen: false,
        lignes: [
          ligne("revenusFCFA", "revenus", "somme", "montant"),
          ligne("apportsFCFA", "apports", "somme", "montant"),
          ligne("coutAlimentsFCFA", "coutAliments", "somme", "montant"),
          ligne("coutAlevinsFCFA", "coutAlevins", "somme", "montant"),
          ligne("baseRepartitionFCFA", "chargesReparties", "somme", "montant"),
          ligne("investissementsFCFA", "investissements", "somme", "montant"),
          ligne("epargneFCFA", "epargneConseillee", "somme", "montant"),
        ],
      },
      {
        // Story PR2q.4 — "au-dela du classeur" : ventilations demandees par
        // l'utilisateur, section DEDIEE et repliee par defaut (§7.1) pour ne
        // jamais alourdir le premier ecran, y compris pour un scenario a de
        // nombreux postes. Ces lignes n'ajoutent AUCUN chiffre nouveau : leur
        // somme reconstitue exactement les lignes agregees deja affichees
        // plus haut ("Apports (FCFA)", "Charges reparties (FCFA)") — voir
        // `src/lib/previsions/ventilations.ts` pour la garantie testee.
        id: "ventilations",
        title: t("previsionsMensuellesTab.sections.ventilations"),
        defaultOpen: false,
        lignes: [
          ...lignesApportsParType,
          ...lignesDepensesParPoste,
          {
            id: "depenseJournalGeneral",
            accessor: (m: MoisProjectionDTO) => ventilationDepenses.journalGeneral.get(m.moisAbsolu) ?? 0,
            totalMode: "somme" as TotalMode,
            format: "montant" as LigneFormat,
            label: t("previsionsMensuellesTab.rows.depenseJournalGeneral.label"),
            formule: t("previsionsMensuellesTab.rows.depenseJournalGeneral.formule"),
          },
        ],
      },
    ];
  }, [t, lignesGranulometrie, lignesDetailParVague, lignesApportsParType, lignesDepensesParPoste, ventilationDepenses]);

  if (mois.length === 0) {
    if (erreurProjection) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">{t("page.errors.projectionUnavailable")}</p>
            <p className="mt-1 text-sm text-danger/90">{erreurProjection}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("previsionsMensuellesTab.errorHint")}
            </p>
          </div>
        </div>
      );
    }
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("previsionsMensuellesTab.noData")}
      </p>
    );
  }

  const toggleSection = (id: string) =>
    setSectionsOuvertes((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    /*
     * UN SEUL tableau, servi a toutes les tailles d'ecran (375px, 768px,
     * 1280px) — cf. doc d'en-tete "Tableau unique a toutes les tailles".
     * `relative` porte le degrade d'affordance de bord droit (position
     * absolue par rapport a ce wrapper, pas au conteneur qui defile).
     */
    <div className="relative">
      <div
        className="overflow-x-auto overscroll-x-contain touch-pan-x rounded-lg border border-border [-webkit-overflow-scrolling:touch]"
      >
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th
                className={cn(
                  "sticky left-0 z-10 border-r border-border bg-card px-2 py-2 font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] sm:px-3",
                  COLONNE_INDICATEUR_CLASSES
                )}
              >
                <span className="block truncate">{t("previsionsMensuellesTab.indicatorColumn")}</span>
              </th>
              {mois.map((m) => (
                <th key={m.moisAbsolu} className="px-2 py-2 text-right font-medium whitespace-nowrap sm:px-3">
                  {libelleMoisCalendaire(dateDebut, m.moisAbsolu)}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium whitespace-nowrap sm:px-3">
                {t("previsionsMensuellesTab.totalColumn")}
              </th>
            </tr>
          </thead>
          {SECTIONS.map((section) => {
            const ouvert = sectionsOuvertes[section.id] ?? section.defaultOpen;
            return (
              <tbody key={section.id}>
                <EnTeteRepliable
                  title={section.title}
                  ouvert={ouvert}
                  onToggle={() => toggleSection(section.id)}
                  nbColonnesRestantes={mois.length + 1}
                />
                {ouvert &&
                  section.lignes.map((l) => (
                    <LigneRow key={l.id} ligne={l} mois={mois} t={t} />
                  ))}
                {/*
                 * Story PR2sex.3 — sous-groupes (ex. "Détail par mois de
                 * cycle") rendus APRES les lignes plates de la section, dans
                 * le MEME <tbody> — jamais un second systeme, la cle
                 * composee suffit a isoler l'etat de repli.
                 */}
                {ouvert &&
                  section.groupes?.map((groupe) => {
                    const cleGroupe = `${section.id}.${groupe.id}`;
                    const groupeOuvert = sectionsOuvertes[cleGroupe] ?? false;
                    return (
                      <Fragment key={cleGroupe}>
                        <EnTeteRepliable
                          title={groupe.title}
                          ouvert={groupeOuvert}
                          onToggle={() => toggleSection(cleGroupe)}
                          nbColonnesRestantes={mois.length + 1}
                        />
                        {groupeOuvert &&
                          groupe.lignes.map((l) => (
                            <LigneRow key={l.id} ligne={l} mois={mois} t={t} />
                          ))}
                      </Fragment>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
      </div>
      {/*
       * Affordance de defilement (item 4 de la demande utilisateur) : degrade
       * discret sur le bord droit, jamais interactif (`pointer-events-none`),
       * qui suggere que du contenu continue au-dela du cadre visible — voir
       * doc d'en-tete pour la justification du choix (statique, pas asservi
       * a `scrollLeft`).
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-lg bg-gradient-to-l from-[var(--card)] to-transparent sm:w-8"
      />
    </div>
  );
}

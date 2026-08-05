/**
 * src/lib/queries/previsions-vue-rapprochement.ts
 *
 * Orchestration de l'onglet Rapprochement (Sprint PR3, story PR3.7,
 * ADR-053 section 15, §6.4 des exigences fonctionnelles) : charge le
 * rapprochement complet d'un scenario sur TOUT son horizon (comme
 * `calculerProjectionScenario`, appele une seule fois par la page — jamais
 * un fetch par mois selectionne cote client, cf. `ScenarioDetailClient` et
 * son commentaire d'entete sur `router.refresh()`), puis pre-calcule les 4
 * vues du §6.4 (mensuelle, cumulee, par vague, top ecarts) en appelant
 * EXCLUSIVEMENT les fonctions du moteur pur
 * (`src/lib/previsions/rapprochement.ts`,
 * `src/lib/previsions/rapprochement-vagues.ts`) — ce fichier ne recalcule
 * AUCUN ecart, AUCUN signe, AUCUNE couleur (ADR-053 section 15.6 point 2,
 * ERR-171).
 *
 * ROLE STRICT : charge (queries), appelle le moteur pur, retourne en
 * valeur — ce fichier N'ECRIT JAMAIS dans `Depense`, `Vente`,
 * `MouvementStock` ni aucune table du domaine reel (ADR-053 section
 * 5.1(a)).
 */
import {
  agregerCumule,
  agregerParMois,
  agregerParPoste,
  calculerEcart,
  calculerSensEcart,
  couleurPourSensEcart,
  extraireBacNonRapproche,
  topEcartsDuMois,
  SEUILS_ECART_PAR_DEFAUT,
  type AgregatEcart,
  type AgregatMois,
  type AgregatPoste,
} from "@/lib/previsions/rapprochement";
import type { CouleurEcart, LigneRapprochement, NatureGrandeur, SensEcart } from "@/lib/previsions/types";
import type { Decimal } from "@/lib/previsions/decimal-config";
import { calculerRapprochementScenario } from "@/lib/queries/previsions-rapprochement";
import { construireVueParVague, type VagueRapprochementRow, type VaguePrevuePourVueInput } from "@/lib/previsions/rapprochement-vagues";
import { getCoutsReelsParVagues } from "@/lib/queries/previsions-vagues-couts-reels";
import type { ProjectionScenarioResult } from "@/lib/previsions/route-orchestration";
import type { ScenarioPourCalcul } from "@/lib/queries/previsions-scenario-loader";

/**
 * `AgregatPoste` (moteur) enrichi de `natureGrandeur`/`ecartPct`/`sens`/
 * `couleur` — necessaire pour la vue cumulee "detail par poste" (memes
 * colonnes que la vue mensuelle). Chaque poste est de nature HOMOGENE
 * (un `PostePrevision` est toujours DEPENSE, un `AlimentPrevision`
 * toujours QUANTITE, etc. — cf. `construireEntreesPrevuesDepuisScenario`),
 * ce qui rend `sens`/`couleur` bien definis au niveau agregat, contrairement
 * a un total GLOBAL qui mélangerait des natures differentes (jamais
 * calcule ici pour cette raison — `cumuleGlobalParMois` reste un total
 * numerique brut, sans sens).
 */
export interface AgregatPosteComparaison extends AgregatPoste {
  natureGrandeur: NatureGrandeur;
  ecartPct: Decimal | null;
  sens: SensEcart;
  couleur: CouleurEcart;
}

/**
 * Enrichit chaque `AgregatPoste` de son `sens`/`couleur`, en appelant
 * EXCLUSIVEMENT `calculerEcart`/`calculerSensEcart`/`couleurPourSensEcart`
 * (moteur) — jamais une comparaison recalculee ici (ERR-171). La
 * `natureGrandeur` du poste est lue depuis n'importe quelle ligne source du
 * groupe (toutes identiques par construction, cf. doc `AgregatPosteComparaison`).
 *
 * Cas `SANS_SOURCE_REELLE` : si TOUTES les lignes du poste portent ce
 * statut (ex. le poste "Apports en capital"), `reel` est passe `null` a
 * `calculerEcart` — jamais le `totalReel` a 0 de l'agregat, qui vaut 0
 * uniquement parce qu'aucune ligne "reelle" n'y a contribue (ADR-053 §15.1).
 */
function enrichirAgregatsPoste(agregats: AgregatPoste[], lignesSource: LigneRapprochement[]): AgregatPosteComparaison[] {
  return agregats.map((a) => {
    const ligneRef = lignesSource.find((l) => l.id.startsWith(`${a.cle}::`));
    const natureGrandeur: NatureGrandeur = ligneRef?.natureGrandeur ?? "DEPENSE";
    const toutSansSourceReelle = a.nombreLignes > 0 && a.nombreLignesSansSourceReelle === a.nombreLignes;
    const reelPourEcart = toutSansSourceReelle ? null : a.totalReel;
    const { ecartPct } = calculerEcart(a.totalPrevu, reelPourEcart);
    const sens = calculerSensEcart(natureGrandeur, toutSansSourceReelle ? null : a.totalEcartAbsolu);
    const couleur = couleurPourSensEcart(sens, ecartPct, SEUILS_ECART_PAR_DEFAUT);
    return { ...a, natureGrandeur, ecartPct, sens, couleur };
  });
}

export interface RapprochementScenarioVue {
  horizonMois: number;
  /** [0..horizonMois-1] */
  moisDisponibles: number[];
  /** Vue mensuelle : toutes les lignes de chaque mois (tous statuts confondus). */
  lignesParMois: Map<number, LigneRapprochement[]>;
  /** Agregat total (toutes lignes confondues) de chaque mois — ligne "Total" de la vue mensuelle. */
  totalMoisParMois: Map<number, AgregatMois>;
  /** Bac "Non rapproche" (ADR-053 section 5) — TOUJOURS present, tableau vide si aucune categorie non rapprochee ce mois. */
  nonRapprocheParMois: Map<number, LigneRapprochement[]>;
  /** Vue cumulee — total toutes lignes confondues, depuis le debut de l'horizon jusqu'a (et y compris) ce mois. */
  cumuleGlobalParMois: Map<number, AgregatEcart>;
  /** Vue cumulee, detail par poste — memes bornes que `cumuleGlobalParMois`. */
  cumuleParPosteParMois: Map<number, AgregatPosteComparaison[]>;
  /** Vue "Top ecarts" — les `n` lignes de plus grand |ecartAbsolu| de ce mois. */
  topEcartsParMois: Map<number, LigneRapprochement[]>;
  /** Vue "par vague" — une ligne par VaguePrevue active du scenario (ANNULEE exclue, meme perimetre que `projection.vagues`). */
  vagues: VagueRapprochementRow[];
  /** Instant du calcul serveur (ADR-053 §5.1(b), fraicheur) — jamais une photo figee d'un import passe. */
  calculeLe: Date;
}

/**
 * Charge et compose le rapprochement complet d'un scenario, sur tout son
 * horizon. `scenario`/`projection` doivent deja avoir ete charges/calcules
 * par l'appelant (meme instance que celle utilisee pour la projection —
 * jamais un second chargement/calcul independant qui pourrait diverger,
 * ADR-053 section 15.6 point 1 : le prevu vient TOUJOURS du moteur de
 * production).
 */
export async function chargerRapprochementScenario(
  scenarioId: string,
  siteId: string,
  scenario: ScenarioPourCalcul,
  projection: ProjectionScenarioResult
): Promise<RapprochementScenarioVue> {
  const horizonMois = projection.horizonMois;
  const moisDisponibles = Array.from({ length: horizonMois }, (_, i) => i);
  const calculeLe = new Date();

  const lignes =
    horizonMois > 0 ? await calculerRapprochementScenario(scenarioId, siteId, 0, horizonMois - 1) : [];

  const lignesParMois = new Map<number, LigneRapprochement[]>();
  const nonRapprocheParMois = new Map<number, LigneRapprochement[]>();
  const cumuleGlobalParMois = new Map<number, AgregatEcart>();
  const cumuleParPosteParMois = new Map<number, AgregatPosteComparaison[]>();
  const topEcartsParMois = new Map<number, LigneRapprochement[]>();

  for (const m of moisDisponibles) {
    const lignesDuMois = lignes.filter((l) => l.moisAbsolu === m);
    lignesParMois.set(m, lignesDuMois);
    nonRapprocheParMois.set(m, extraireBacNonRapproche(lignesDuMois));

    const lignesJusquAM = lignes.filter((l) => l.moisAbsolu <= m);
    cumuleGlobalParMois.set(m, agregerCumule(lignesJusquAM));
    cumuleParPosteParMois.set(m, enrichirAgregatsPoste(agregerParPoste(lignesJusquAM), lignesJusquAM));

    topEcartsParMois.set(m, topEcartsDuMois(lignes, m, 5));
  }

  const totalMoisParMois = new Map<number, AgregatMois>(agregerParMois(lignes).map((a) => [a.moisAbsolu, a]));

  const vagueReelleIdParVaguePrevueId = new Map(
    scenario.vaguesPrevues.map((vp) => [vp.id, vp.vagueReelleId])
  );

  const vaguesPrevuesInput: VaguePrevuePourVueInput[] = projection.vagues.map((v) => ({
    vaguePrevueId: v.vaguePrevueId,
    codePrevu: v.code,
    statut: v.statut,
    vagueReelleId: vagueReelleIdParVaguePrevueId.get(v.vaguePrevueId) ?? null,
    coutProductionFCFA: v.coutProductionFCFA,
    revenuPrevuFCFA: v.revenuPrevuFCFA,
    biomasseKg: v.biomasseKg,
  }));

  const vagueReelleIds = vaguesPrevuesInput
    .map((v) => v.vagueReelleId)
    .filter((id): id is string => id !== null);
  const reelParVagueReelleId = await getCoutsReelsParVagues(siteId, vagueReelleIds);
  const vagues = construireVueParVague(vaguesPrevuesInput, reelParVagueReelleId);

  return {
    horizonMois,
    moisDisponibles,
    lignesParMois,
    totalMoisParMois,
    nonRapprocheParMois,
    cumuleGlobalParMois,
    cumuleParPosteParMois,
    topEcartsParMois,
    vagues,
    calculeLe,
  };
}

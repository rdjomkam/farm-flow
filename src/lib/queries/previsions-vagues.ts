/**
 * src/lib/queries/previsions-vagues.ts
 *
 * Queries Prisma — VaguePrevue, AlimentParVaguePrevue (Sprint PR2, story
 * PR2.1). Coeur metier du module : plan d'empoissonnement + besoin aliment
 * par vague. Reference ADR-053, section 3.6, decisions 1 et 2.
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture.
 * R4 : `scinderVaguePrevue` et `replaceAlimentsParVaguePrevue` sont des
 *      remplacements/creations en bloc dans une seule transaction.
 * Piege Prisma 7 : `createVaguePrevue` cree la VaguePrevue (FK brute
 *      `scenarioId`) SANS include, puis recharge via `findUniqueOrThrow` +
 *      `include`.
 *
 * Regle metier (ADR-053 decision 2) : la suppression d'une VaguePrevue
 * rattachee a une vague reelle (`Vague.vaguePrevueId` non nul) est
 * INTERDITE — le statut passe a ANNULEE a la place. Ce fichier n'expose
 * DELIBEREMENT aucune fonction `deleteVaguePrevue` : seule `annulerVaguePrevue`
 * existe, pour rendre cette regle structurellement impossible a contourner
 * depuis la couche API (pas seulement documentee).
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { StatutVaguePrevue } from "@/types";
import { genererPlanEmpoissonnement } from "@/lib/previsions";
import { prismaDecimalToEngine } from "@/lib/previsions/decimal-io";

/**
 * Garde applicative — colonnes Prisma `Int` de ce module.
 *
 * BUG constate empiriquement (story PR2.1, test DB-gated
 * `previsions-int-fractional-integration.test.ts`, contre un vrai Postgres,
 * Docker port 8432) : le client Prisma NE REJETTE PAS une valeur `number`
 * fractionnaire destinee a une colonne `Int` — il la TRONQUE SILENCIEUSEMENT
 * vers zero (`Math.trunc`, ex. `3.7` -> `3`), sans lever d'exception, AVANT
 * meme d'atteindre Postgres. Le driver `pg` nu, lui, rejette la meme valeur
 * sur une vraie colonne `integer` (`22P02 invalid input syntax for type
 * integer`) — mais ce rejet Postgres n'est jamais atteint, car Prisma a deja
 * tronque la valeur en amont. Cette garde est donc la SEULE protection
 * reelle contre une corruption silencieuse de donnees pour les colonnes
 * `Int` de ce module (defense en profondeur : rien dans le chemin
 * applicatif reel actuel ne produit aujourd'hui une valeur fractionnaire,
 * mais l'absence de garde etait un risque latent).
 *
 * R4 : appelee en tout premier, AVANT toute lecture/ecriture — dans la
 * transaction quand la fonction en ouvre une (`replaceAlimentsParVaguePrevue`),
 * en tete de fonction sinon (`updateSacsSaisis`) : jamais un check-then-write
 * qui laisserait une fenetre entre la validation et l'ecriture.
 *
 * @throws {Error} si `valeur` n'est pas un entier — message exploitable tel
 *   quel par la couche API (PR2.2) pour une reponse 400.
 */
function assertEntierColonneInt(valeur: number, nomChamp: string): void {
  if (!Number.isInteger(valeur)) {
    throw new Error(
      `${nomChamp} doit etre un entier (colonne Prisma Int) — valeur recue : ${valeur}.`
    );
  }
}

export interface CreateVaguePrevueDTO {
  code: string;
  dateStockagePrevue: string;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: number;
  /** a defaut, retombe sur ParametresPrevision.alevinsAchetesParDefaut (ADR-053 §14 / ERR-170) */
  alevinsAchetes?: boolean;
}

/**
 * Champs editables d'une VaguePrevue existante. `dureeCycleMoisFigee` est
 * DELIBEREMENT absent de ce type : c'est une copie gelee de
 * `scenario.dureeCycleMois` au moment de la creation (ADR-053 decision 1),
 * jamais modifiable directement par une mise a jour utilisateur — seule la
 * creation (`createVaguePrevue`) et la scission (`scinderVaguePrevue`, qui la
 * copie depuis le parent) la renseignent.
 */
export interface UpdateVaguePrevueDTO {
  code?: string;
  dateStockagePrevue?: string;
  effectifAlevinsPrevu?: number;
  poidsMoyenInitialG?: number;
  alevinsAchetes?: boolean;
}

export interface ScissionVaguePrevueDTO {
  code: string;
  dateStockagePrevue: string;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: number;
}

/**
 * Une ligne de besoin aliment calculee par le moteur pour une VaguePrevue,
 * un AlimentPrevision et un mois de cycle donnes (ADR-053 section 3.6).
 *
 * IMPORTANT — homonymie `sacsCalcules` (reserve 6 de PR1, tranchee par
 * documentation seule, pas de renommage, cf. pre-analyse PR2.1) :
 * `sacsCalcules` ici est le MEME NOM que `AlimentParVagueCalcInput.sacsCalcules`
 * et `AlimentParVagueMensuelCalcInput.sacsCalculesCycle`
 * (`src/lib/previsions/aliments.ts`), mais ce N'EST PAS la meme contrainte de
 * type : la colonne Prisma `AlimentParVaguePrevue.sacsCalcules` est un `Int`
 * STRICT (sortie `ceil()` du moteur, `calculerBesoinAlimentMensuel`), alors
 * que les types en memoire du moteur acceptent une valeur `number`
 * potentiellement fractionnaire (utilisee UNIQUEMENT dans la recette PR1.4
 * comme proxy d'echelle pour la decision de palier de remise — jamais dans
 * le chemin applicatif reel). Cette query (et `updateSacsSaisis` ci-dessous)
 * DOIT toujours ecrire un entier reel dans `sacsCalcules`/`sacsSaisis` — issu
 * de `calculerBesoinAlimentMensuel` (deja `ceil`) ou d'une saisie utilisateur
 * explicitement entiere — jamais reproduire le calcul non arrondi de la
 * recette dans du code applicatif.
 */
export interface AlimentParVaguePrevueInputDTO {
  alimentPrevisionId: string;
  moisCycle: number;
  /** entier reel — cf. JSDoc ci-dessus sur l'homonymie avec le moteur */
  sacsCalcules: number;
  sacsSaisis: number | null;
  quantiteKgCalculee: number;
  coutCalculeFCFA: number;
}

const INCLUDE_VAGUE_PREVUE_DETAIL = {
  alimentsParMois: {
    orderBy: [{ alimentPrevisionId: "asc" as const }, { moisCycle: "asc" as const }],
  },
  journal: { orderBy: { date: "asc" as const } },
  vague: true,
  enfantsScission: true,
};

/**
 * Liste les VaguePrevue d'un scenario, avec filtre optionnel sur le statut.
 * `withAliments` evite de charger inutilement le detail mensuel sur une
 * simple liste de plan (parametre explicite, pas un `include` systematique).
 */
export async function getVaguesPrevuesParScenario(
  scenarioId: string,
  siteId: string,
  filters?: { statut?: StatutVaguePrevue; withAliments?: boolean }
) {
  return prisma.vaguePrevue.findMany({
    where: {
      scenarioId,
      siteId,
      ...(filters?.statut && { statut: filters.statut }),
    },
    include: filters?.withAliments
      ? { alimentsParMois: true }
      : undefined,
    orderBy: { dateStockagePrevue: "asc" },
  });
}

/** Recupere une VaguePrevue par id, avec ses aliments par mois, son journal, sa vague reelle liee et ses enfants de scission. */
export async function getVaguePrevueById(id: string, siteId: string) {
  return prisma.vaguePrevue.findFirst({
    where: { id, siteId },
    include: INCLUDE_VAGUE_PREVUE_DETAIL,
  });
}

/**
 * Cree une VaguePrevue. Copie `dureeCycleMoisFigee` depuis
 * `scenario.dureeCycleMois` AU MOMENT DE LA CREATION (ADR-053 decision 1) —
 * jamais recalculee si le scenario change ensuite.
 */
export async function createVaguePrevue(
  scenarioId: string,
  siteId: string,
  data: CreateVaguePrevueDTO
) {
  return prisma.$transaction(async (tx) => {
    assertEntierColonneInt(data.effectifAlevinsPrevu, "effectifAlevinsPrevu");

    const scenario = await tx.scenarioPrevision.findFirst({
      where: { id: scenarioId, siteId },
      include: { parametres: { select: { alevinsAchetesParDefaut: true } } },
    });
    if (!scenario) {
      throw new Error("Scenario introuvable");
    }
    if (!scenario.parametres) {
      throw new Error("Le scenario n'a pas de ParametresPrevision (etat incoherent)");
    }

    const vaguePrevue = await tx.vaguePrevue.create({
      data: {
        scenarioId,
        code: data.code,
        dateStockagePrevue: new Date(data.dateStockagePrevue),
        effectifAlevinsPrevu: data.effectifAlevinsPrevu,
        poidsMoyenInitialG: data.poidsMoyenInitialG,
        dureeCycleMoisFigee: scenario.dureeCycleMois,
        alevinsAchetes: data.alevinsAchetes ?? scenario.parametres.alevinsAchetesParDefaut,
        statut: StatutVaguePrevue.PLANIFIEE,
        siteId,
      },
    });

    return tx.vaguePrevue.findUniqueOrThrow({
      where: { id: vaguePrevue.id },
      include: INCLUDE_VAGUE_PREVUE_DETAIL,
    });
  });
}

/**
 * Met a jour une VaguePrevue (champs editables uniquement — voir
 * `UpdateVaguePrevueDTO`, `dureeCycleMoisFigee` en est deliberement exclu).
 */
export async function updateVaguePrevue(
  id: string,
  siteId: string,
  data: UpdateVaguePrevueDTO
) {
  if (data.effectifAlevinsPrevu !== undefined) {
    assertEntierColonneInt(data.effectifAlevinsPrevu, "effectifAlevinsPrevu");
  }

  const { count } = await prisma.vaguePrevue.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.dateStockagePrevue !== undefined && {
        dateStockagePrevue: new Date(data.dateStockagePrevue),
      }),
      ...(data.effectifAlevinsPrevu !== undefined && {
        effectifAlevinsPrevu: data.effectifAlevinsPrevu,
      }),
      ...(data.poidsMoyenInitialG !== undefined && { poidsMoyenInitialG: data.poidsMoyenInitialG }),
      ...(data.alevinsAchetes !== undefined && { alevinsAchetes: data.alevinsAchetes }),
    },
  });
  if (count === 0) {
    throw new Error("VaguePrevue introuvable");
  }
  return prisma.vaguePrevue.findUniqueOrThrow({
    where: { id },
    include: INCLUDE_VAGUE_PREVUE_DETAIL,
  });
}

/**
 * Scinde une VaguePrevue en N nouvelles VaguePrevue (ADR-053 decision 2,
 * ex. V7 -> V7a + V7b) : transaction obligatoire (R4) qui cree les enfants
 * avec `vaguePrevueParentId = id`, statut `PLANIFIEE`, `dureeCycleMoisFigee`
 * copiee depuis le PARENT (jamais depuis `scenario.dureeCycleMois` courant,
 * pour rester coherent avec la decision 1 : une valeur deja figee ne se
 * "refige" jamais depuis une source plus fraiche) — puis passe le parent en
 * `ANNULEE`. Jamais une suppression physique du parent.
 *
 * Au moins 2 scissions sont exigees : une scission a 1 seul enfant n'a pas
 * de sens metier (le cas d'usage est "un lot livre en plusieurs temps",
 * ADR-053 section 2.2).
 */
export async function scinderVaguePrevue(
  id: string,
  siteId: string,
  scissions: ScissionVaguePrevueDTO[]
) {
  if (scissions.length < 2) {
    throw new Error("Une scission doit produire au moins 2 vagues prevues");
  }

  return prisma.$transaction(async (tx) => {
    for (const s of scissions) {
      assertEntierColonneInt(s.effectifAlevinsPrevu, "effectifAlevinsPrevu");
    }

    const parent = await tx.vaguePrevue.findFirst({
      where: { id, siteId },
      select: { id: true, scenarioId: true, dureeCycleMoisFigee: true, alevinsAchetes: true },
    });
    if (!parent) {
      throw new Error("VaguePrevue introuvable");
    }

    const enfants = await Promise.all(
      scissions.map((s) =>
        tx.vaguePrevue.create({
          data: {
            scenarioId: parent.scenarioId,
            code: s.code,
            dateStockagePrevue: new Date(s.dateStockagePrevue),
            effectifAlevinsPrevu: s.effectifAlevinsPrevu,
            poidsMoyenInitialG: s.poidsMoyenInitialG,
            dureeCycleMoisFigee: parent.dureeCycleMoisFigee,
            alevinsAchetes: parent.alevinsAchetes,
            statut: StatutVaguePrevue.PLANIFIEE,
            vaguePrevueParentId: parent.id,
            siteId,
          },
        })
      )
    );

    await tx.vaguePrevue.update({
      where: { id: parent.id },
      data: { statut: StatutVaguePrevue.ANNULEE },
    });

    return tx.vaguePrevue.findMany({
      where: { id: { in: enfants.map((e) => e.id) } },
      include: INCLUDE_VAGUE_PREVUE_DETAIL,
    });
  });
}

/**
 * Annule une VaguePrevue (statut -> ANNULEE). INTERDIT si une vague reelle
 * est rattachee (`Vague.vaguePrevueId` non nul), ADR-053 decision 2 —
 * verification explicite avant ecriture (pas de contrainte DB pour cette
 * regle, donc portee ici).
 */
/**
 * Annule une VaguePrevue (ADR-053 decision 2 : jamais de suppression d'une
 * VaguePrevue rattachee a une vague reelle, statut ANNULEE a la place).
 *
 * R4 : l'ecriture elle-meme est conditionnee (`updateMany` avec `vague: null`
 * dans le `where`) — pas un check-then-update. Verifier `vagueReelleLiee` puis
 * appeler `update({ where: { id } })` sans reconditionner laisserait une
 * fenetre de course : un rattachement concurrent (`Vague.vaguePrevueId`)
 * pourrait s'intercaler entre la lecture et l'ecriture. Ici, si une vague
 * reelle est (ou vient d'etre) rattachee au moment exact de l'ecriture,
 * `count` vaut 0 et l'annulation est refusee — jamais une annulation qui
 * passerait malgre un rattachement concurrent.
 */
export async function annulerVaguePrevue(id: string, siteId: string) {
  const { count } = await prisma.vaguePrevue.updateMany({
    where: { id, siteId, vague: null },
    data: { statut: StatutVaguePrevue.ANNULEE },
  });

  if (count === 0) {
    const vaguePrevue = await prisma.vaguePrevue.findFirst({
      where: { id, siteId },
      select: { id: true },
    });
    if (!vaguePrevue) {
      throw new Error("VaguePrevue introuvable");
    }
    throw new Error(
      "Impossible d'annuler une VaguePrevue rattachee a une vague reelle. Cloturez/detachez la vague reelle d'abord."
    );
  }

  return prisma.vaguePrevue.findUniqueOrThrow({ where: { id } });
}

/**
 * Rattache une vague reelle a une VaguePrevue (`Vague.vaguePrevueId`). La
 * contrainte `@unique` de Prisma sur `Vague.vaguePrevueId` fait respecter le
 * rejet en cas de double-rattachement (ADR-053 decision 2) — PAS de
 * verification prealable qui dupliquerait ce que la contrainte DB fait deja
 * (R4). En cas de conflit, Prisma leve `P2002` — a l'appelant (route API,
 * PR2.2) de le traduire en flux de scission propose a l'utilisateur.
 */
export async function rattacherVaguePrevue(
  vagueId: string,
  vaguePrevueId: string,
  siteId: string
) {
  const vaguePrevue = await prisma.vaguePrevue.findFirst({
    where: { id: vaguePrevueId, siteId },
    select: { id: true },
  });
  if (!vaguePrevue) {
    throw new Error("VaguePrevue introuvable");
  }

  const { count } = await prisma.vague.updateMany({
    where: { id: vagueId, siteId },
    data: { vaguePrevueId },
  });
  if (count === 0) {
    throw new Error("Vague introuvable");
  }

  return prisma.vague.findUniqueOrThrow({ where: { id: vagueId } });
}

/**
 * Remplace en bloc les AlimentParVaguePrevue d'une VaguePrevue (R4,
 * `deleteMany` + `createMany` dans la meme transaction) — resultat du
 * moteur, `sacsCalcules`/`sacsSaisis` toujours des entiers (colonne `Int`,
 * jamais `Decimal` — cf. JSDoc `AlimentParVaguePrevueInputDTO` sur
 * l'homonymie avec le moteur).
 */
export async function replaceAlimentsParVaguePrevue(
  vaguePrevueId: string,
  siteId: string,
  lignes: AlimentParVaguePrevueInputDTO[]
) {
  return prisma.$transaction(async (tx) => {
    for (const l of lignes) {
      assertEntierColonneInt(l.moisCycle, "moisCycle");
      assertEntierColonneInt(l.sacsCalcules, "sacsCalcules");
      if (l.sacsSaisis !== null) {
        assertEntierColonneInt(l.sacsSaisis, "sacsSaisis");
      }
    }

    const vaguePrevue = await tx.vaguePrevue.findFirst({
      where: { id: vaguePrevueId, siteId },
      select: { id: true },
    });
    if (!vaguePrevue) {
      throw new Error("VaguePrevue introuvable");
    }

    await tx.alimentParVaguePrevue.deleteMany({ where: { vaguePrevueId } });

    if (lignes.length > 0) {
      await tx.alimentParVaguePrevue.createMany({
        data: lignes.map((l) => ({
          vaguePrevueId,
          alimentPrevisionId: l.alimentPrevisionId,
          moisCycle: l.moisCycle,
          sacsCalcules: l.sacsCalcules,
          sacsSaisis: l.sacsSaisis,
          quantiteKgCalculee: l.quantiteKgCalculee,
          coutCalculeFCFA: l.coutCalculeFCFA,
          siteId,
        })),
      });
    }

    return tx.alimentParVaguePrevue.findMany({
      where: { vaguePrevueId },
      orderBy: [{ alimentPrevisionId: "asc" }, { moisCycle: "asc" }],
    });
  });
}

/**
 * Met a jour la surcharge manuelle `sacsSaisis` d'une ligne
 * AlimentParVaguePrevue (ADR-053 section 3.6 : `null` = utiliser
 * `sacsCalcules`, non-null = surcharge terrain). Update cible, atomique
 * (R4 : `updateMany` avec condition `siteId`, pas de check-then-update).
 */
export async function updateSacsSaisis(
  alimentParVaguePrevueId: string,
  siteId: string,
  sacsSaisis: number | null
) {
  if (sacsSaisis !== null) {
    assertEntierColonneInt(sacsSaisis, "sacsSaisis");
  }

  const { count } = await prisma.alimentParVaguePrevue.updateMany({
    where: { id: alimentParVaguePrevueId, siteId },
    data: { sacsSaisis },
  });
  if (count === 0) {
    throw new Error("Ligne AlimentParVaguePrevue introuvable");
  }
  return prisma.alimentParVaguePrevue.findUniqueOrThrow({
    where: { id: alimentParVaguePrevueId },
  });
}

// -----------------------------------------------------------------------------
// Generation du plan d'empoissonnement (Sprint PR2bis, story PR2bis.2)
// -----------------------------------------------------------------------------
//
// Cable ici `genererPlanEmpoissonnement` (moteur pur, `src/lib/previsions/plan.ts`,
// INTOUCHABLE — recette 1270 tests / 0 ecart). Cette section est le SEUL
// chemin d'ecriture qui l'appelle ; le moteur reste sans I/O (ADR-053 section 4).
//
// Les 5 des 6 parametres du moteur sont deja persistes (ScenarioPrevision +
// ParametresPrevision) et JAMAIS resaisis par le client : seul `horizonMois`
// est un input utilisateur reel (pre-analyse PR2bis.2 section 2). Ne jamais
// faire confiance a un `dateDebutPlan`/`dureeCycleMois`/effectif envoye par le
// client — toujours relire le scenario cote serveur.

export type ModeGenerationPlan = "ajouter" | "remplacer";

export interface ApercuGenerationPlanResult {
  horizonMois: number;
  mode: ModeGenerationPlan;
  /** VaguePrevue deja rattachees a une vague reelle — jamais touchees, quel que soit le mode. */
  nombreVaguesRattacheesConservees: number;
  /** Mode "remplacer" uniquement : PLANIFIEE ET non rattachees, qui seront annulees avant regeneration. */
  nombreVaguesAnnuleesEtRemplacees: number;
  /** Nombre de VaguePrevue qui seront effectivement creees par cet appel. */
  nombreNouvellesVagues: number;
  premiereDateStockagePrevue: string | null;
  derniereDateStockagePrevue: string | null;
  /** Codes qui seront attribues aux nouvelles VaguePrevue, dans l'ordre de stockage. */
  codesGeneres: string[];
}

/**
 * Plus haut numero de code deja attribue dans ce scenario, toutes VaguePrevue
 * confondues (y compris ANNULEE — une ligne ANNULEE occupe toujours sa ligne
 * de code, contrainte `@@unique([scenarioId, code])`). Une (re)generation doit
 * donc TOUJOURS attribuer des codes neufs a partir de ce numero + 1, jamais
 * reutiliser V1..Vn (arbitrage PM, story PR2bis.2). Codes ne suivant pas le
 * motif "V<entier>" (saisie libre lors d'une creation manuelle) sont ignores
 * pour ce calcul plutot que de faire echouer la fonction.
 */
function plusHautNumeroCode(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const m = /^V(\d+)/i.exec(code);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max;
}

interface VaguePrevueExistanteResume {
  id: string;
  code: string;
  // `string` (pas `StatutVaguePrevue`) : le retour de Prisma porte l'enum
  // GENERE (`@/generated/prisma/enums`), nominalement distinct de l'enum
  // miroir `@/types` malgre des valeurs litterales identiques — comparer
  // avec `StatutVaguePrevue.XXX` (import `@/types`) reste valide cote
  // runtime (chaines identiques) et cote types (`string` accepte tout enum).
  statut: string;
  vague: { id: string } | null;
}

/**
 * Charge le scenario + `ParametresPrevision` (404/erreur explicite si absent
 * — jamais un calcul silencieux avec des valeurs manquantes, pre-analyse
 * PR2bis.2 section 2) et la liste resumee des VaguePrevue deja existantes de
 * ce scenario (toutes statuts). Partage entre l'apercu (lecture seule) et
 * l'ecriture (dans la transaction).
 */
async function chargerPourGenerationPlan(
  client: Prisma.TransactionClient | typeof prisma,
  scenarioId: string,
  siteId: string
) {
  const scenario = await client.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    include: { parametres: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }
  if (!scenario.parametres) {
    throw new Error(
      "ParametresPrevision absent pour ce scenario. Renseignez l'onglet Parametres avant de generer un plan."
    );
  }

  const existantes: VaguePrevueExistanteResume[] = await client.vaguePrevue.findMany({
    where: { scenarioId, siteId },
    include: { vague: { select: { id: true } } },
  });

  return { scenario, parametres: scenario.parametres, existantes };
}

/** Appelle le moteur pur avec les parametres deja persistes (jamais resaisis). */
function genererTheorique(
  scenario: { dateDebutPlan: Date; dureeCycleMois: number },
  parametres: {
    effectifAlevinsParVague: number;
    poidsMoyenInitialG: Prisma.Decimal;
    frequenceStockageMois: Prisma.Decimal;
  },
  horizonMois: number
) {
  return genererPlanEmpoissonnement(
    {
      dateDebutPlan: scenario.dateDebutPlan,
      effectifAlevinsParVague: parametres.effectifAlevinsParVague,
      poidsMoyenInitialG: prismaDecimalToEngine(parametres.poidsMoyenInitialG),
    },
    scenario.dureeCycleMois,
    prismaDecimalToEngine(parametres.frequenceStockageMois),
    horizonMois
  );
}

/**
 * Aperçu (dry-run, AUCUNE ecriture) de ce que produirait
 * `genererPlanVaguesPrevues` avec les memes arguments — decompte chiffre
 * exige avant toute action (arbitrage PM, story PR2bis.2) : jamais un
 * remplacement/ajout silencieux.
 */
export async function apercuGenerationPlan(
  scenarioId: string,
  siteId: string,
  horizonMois: number,
  mode: ModeGenerationPlan
): Promise<ApercuGenerationPlanResult> {
  const { scenario, parametres, existantes } = await chargerPourGenerationPlan(prisma, scenarioId, siteId);

  const rattachees = existantes.filter((v) => v.vague !== null);
  const annulables =
    mode === "remplacer"
      ? existantes.filter((v) => v.statut === StatutVaguePrevue.PLANIFIEE && v.vague === null)
      : [];

  const theorique = genererTheorique(scenario, parametres, horizonMois);
  const aCreer = mode === "ajouter" ? theorique.filter((v) => v.index > existantes.length) : theorique;

  let nextNumero = plusHautNumeroCode(existantes.map((v) => v.code)) + 1;
  const codesGeneres = aCreer.map(() => `V${nextNumero++}`);

  const dates = aCreer.map((v) => v.dateStockagePrevue.toISOString());

  return {
    horizonMois,
    mode,
    nombreVaguesRattacheesConservees: rattachees.length,
    nombreVaguesAnnuleesEtRemplacees: annulables.length,
    nombreNouvellesVagues: aCreer.length,
    premiereDateStockagePrevue: dates[0] ?? null,
    derniereDateStockagePrevue: dates[dates.length - 1] ?? null,
    codesGeneres,
  };
}

/**
 * Genere le plan d'empoissonnement (ADR-053 section 4,
 * `genererPlanEmpoissonnement`) et l'ecrit en base — R4 : une seule
 * transaction (chargement + annulation partielle eventuelle + creation en
 * masse), jamais une boucle de `create()` unitaires qui laisserait un plan de
 * 19 vagues a moitie ecrit en cas d'erreur au milieu.
 *
 * Deux modes (arbitrage PM, story PR2bis.2, jamais d'ecrasement silencieux) :
 * - "ajouter" (defaut) : complete le plan a partir de la suite (les
 *   VaguePrevue deja existantes, tous statuts confondus, ne sont JAMAIS
 *   touchees) — seules les vagues theoriques au-dela de ce qui existe deja
 *   sont creees.
 * - "remplacer" : n'est structurellement qu'un remplacement PARTIEL — annule
 *   uniquement les VaguePrevue PLANIFIEE ET non rattachees a une vague
 *   reelle, puis (re)genere le plan complet sur l'horizon demande. Les
 *   EN_COURS, REALISEE et deja-ANNULEE ne sont jamais touchees ; aucune
 *   fonction `deleteVaguePrevue` n'existe et il ne faut pas en creer.
 *
 * Piege Prisma 7 (ERR-136) : `createMany` ne supporte pas `include` — les
 * lignes creees sont relues via `findMany` apres coup, dans la meme
 * transaction.
 */
export async function genererPlanVaguesPrevues(
  scenarioId: string,
  siteId: string,
  horizonMois: number,
  mode: ModeGenerationPlan
) {
  return prisma.$transaction(async (tx) => {
    const { scenario, parametres, existantes } = await chargerPourGenerationPlan(tx, scenarioId, siteId);

    if (mode === "remplacer") {
      const aAnnuler = existantes.filter(
        (v) => v.statut === StatutVaguePrevue.PLANIFIEE && v.vague === null
      );
      if (aAnnuler.length > 0) {
        await tx.vaguePrevue.updateMany({
          where: { id: { in: aAnnuler.map((v) => v.id) } },
          data: { statut: StatutVaguePrevue.ANNULEE },
        });
      }
    }

    const theorique = genererTheorique(scenario, parametres, horizonMois);
    const aCreer = mode === "ajouter" ? theorique.filter((v) => v.index > existantes.length) : theorique;

    if (aCreer.length === 0) {
      return [];
    }

    for (const v of aCreer) {
      assertEntierColonneInt(v.effectifAlevinsPrevu, "effectifAlevinsPrevu");
    }

    let nextNumero = plusHautNumeroCode(existantes.map((v) => v.code)) + 1;
    const codes = aCreer.map(() => `V${nextNumero++}`);

    await tx.vaguePrevue.createMany({
      data: aCreer.map((v, i) => ({
        scenarioId,
        code: codes[i],
        dateStockagePrevue: v.dateStockagePrevue,
        effectifAlevinsPrevu: v.effectifAlevinsPrevu,
        poidsMoyenInitialG: v.poidsMoyenInitialG.toString(),
        dureeCycleMoisFigee: v.dureeCycleMoisFigee,
        alevinsAchetes: parametres.alevinsAchetesParDefaut,
        statut: StatutVaguePrevue.PLANIFIEE,
        siteId,
      })),
    });

    return tx.vaguePrevue.findMany({
      where: { scenarioId, siteId, code: { in: codes } },
      include: INCLUDE_VAGUE_PREVUE_DETAIL,
      orderBy: { dateStockagePrevue: "asc" },
    });
  });
}

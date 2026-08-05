/**
 * src/lib/queries/previsions-charges.ts
 *
 * Queries Prisma — PostePrevision, ChargeMensuellePrevue, JournalDepensePrevue,
 * ApportCapital (Sprint PR2, story PR2.1). Reference ADR-053, section 3.8.
 *
 * R8 : `siteId` filtre sur chaque lecture/ecriture.
 * R4 : `upsertChargeMensuelle` s'appuie sur `@@unique([posteId, moisAbsolu])`
 *      (upsert natif, atomique — pas de transaction explicite necessaire).
 * Piege Prisma 7 : `createPostePrevision`/`createJournalDepensePrevue`/
 *      `createApportCapital` creent SANS include (FK brute `scenarioId`),
 *      lecture separee ensuite si necessaire (ici : pas d'include demande,
 *      donc pas de second appel — documente pour le prochain ajout qui en
 *      aurait besoin).
 */
import { prisma } from "@/lib/db";
import { CategorieJournalPrevu, TypeApportCapital, TypePostePrevision } from "@/types";
import { BusinessRuleError } from "@/lib/errors";
import { sluggifierLibellePoste } from "@/lib/previsions/sluggifier-poste";

/**
 * Type d'un client de transaction interactive Prisma (`tx` dans
 * `prisma.$transaction(async (tx) => …)`). Meme pattern que `numero-utils.ts`,
 * `assignation-bac.ts`, `bons-livraison.ts`.
 */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Garde applicative — colonnes Prisma `Int` de ce module (`PostePrevision.ordre`,
 * `ChargeMensuellePrevue.moisAbsolu`). Meme raison d'etre que la garde homonyme
 * de `previsions-vagues.ts`/`previsions-aliments.ts`/`previsions-scenarios.ts` :
 * Prisma tronque silencieusement (`Math.trunc`, sans exception) une valeur
 * `number` fractionnaire ecrite dans une colonne `Int`, verifie empiriquement
 * contre un vrai Postgres (story PR2.1, cf.
 * `previsions-int-fractional-integration.test.ts`) — cette garde est la seule
 * protection reelle contre une corruption silencieuse. Aggravant specifique a
 * `moisAbsolu` : `ChargeMensuellePrevue` porte `@@unique([posteId, moisAbsolu])`,
 * donc une valeur fractionnaire tronquee peut faire collisionner deux mois
 * distincts et, via `upsert`, ecraser silencieusement la charge du mauvais mois.
 *
 * @throws {BusinessRuleError} (status 400) si `valeur` n'est pas un entier — ERR-165
 */
function assertEntierColonneInt(valeur: number, nomChamp: string): void {
  if (!Number.isInteger(valeur)) {
    throw new BusinessRuleError(
      `${nomChamp} doit etre un entier (colonne Prisma Int) — valeur recue : ${valeur}.`,
      400
    );
  }
}

export interface CreatePostePrevisionDTO {
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition?: boolean;
  ordre: number;
}

export interface CreateJournalDepensePrevueDTO {
  date: string;
  libelle: string;
  categorie: CategorieJournalPrevu;
  montantFCFA: number;
  vaguePrevueId?: string | null;
}

export interface UpdateJournalDepensePrevueDTO {
  date?: string;
  libelle?: string;
  categorie?: CategorieJournalPrevu;
  montantFCFA?: number;
  vaguePrevueId?: string | null;
}

export interface CreateApportCapitalDTO {
  date: string;
  libelle: string;
  montantFCFA: number;
  type: TypeApportCapital;
}

// ---------------------------------------------------------------------------
// PostePrevision
// ---------------------------------------------------------------------------

/** Liste les PostePrevision d'un scenario, ordonnes par `ordre`. */
export async function getPostesPrevisionParScenario(scenarioId: string, siteId: string) {
  return prisma.postePrevision.findMany({
    where: { scenarioId, siteId },
    orderBy: { ordre: "asc" },
  });
}

/**
 * Verifie si une erreur Prisma est une violation P2002 sur la contrainte d'unicite
 * `PosteReferentiel(siteId, code)` precisement (pas n'importe quel P2002 — notamment pas la
 * violation de `PostePrevision(scenarioId, libelle)`, qui doit continuer a remonter telle
 * quelle, cf. `handleApiError`).
 */
function estCollisionUniciteCodeReferentiel(error: unknown): boolean {
  if (
    error === null ||
    typeof error !== "object" ||
    !("code" in error) ||
    (error as { code: unknown }).code !== "P2002"
  ) {
    return false;
  }
  const target = (error as { meta?: { target?: string[] } }).meta?.target;
  return Array.isArray(target) && target.includes("code") && target.includes("siteId");
}

/**
 * Resout (get-or-create) l'entree `PosteReferentiel` du site pour ce `code`, a l'interieur
 * d'une transaction Prisma deja ouverte (ADR-053 §16.11).
 *
 * @throws {BusinessRuleError} (409) si le slug matche une entree referentiel DESACTIVEE du site
 *   — jamais de reactivation silencieuse, jamais de doublon avec un code en collision.
 */
async function resoudrePosteReferentielIdDansTransaction(
  tx: PrismaTransactionClient,
  siteId: string,
  code: string,
  libelleOrigine: string
): Promise<string> {
  const existant = await tx.posteReferentiel.findUnique({
    where: { siteId_code: { siteId, code } },
  });

  if (existant) {
    if (!existant.actif) {
      throw new BusinessRuleError(
        `Un poste referentiel desactive existe deja pour ce libelle ("${existant.libelle}"). ` +
          `Reactivez-le ou choisissez un libelle different plutot que d'en creer un doublon.`,
        409,
        "POSTE_REFERENTIEL_INACTIF"
      );
    }
    return existant.id;
  }

  // `actif` explicite (redondant avec le defaut du schema Prisma @default(true), mais
  // volontaire, R7) : la valeur cree doit etre sans ambiguite pour tout consommateur qui lit
  // cette ligne, y compris un mock de test qui n'applique pas les defauts du schema.
  const cree = await tx.posteReferentiel.create({
    data: { siteId, code, libelle: libelleOrigine, actif: true },
  });
  return cree.id;
}

/**
 * Cree un PostePrevision (chemin par defaut, ADR-053 §16.11) : le contrat de route reste
 * inchange (seul `libelle`), mais la creation resout desormais en interne, par get-or-create
 * transactionnel sur `sluggifierLibellePoste(libelle)`, l'entree `PosteReferentiel` du site a
 * lier — la creant si aucune entree active du site ne porte ce `code`. R4 : tout se passe dans
 * la MEME transaction Prisma que la creation du `PostePrevision` (jamais une entree referentiel
 * creee puis un echec de creation du poste, qui laisserait une entree orpheline sans poste).
 *
 * Concurrence (R4, §16.11) : si deux requetes concomitantes manquent toutes deux le
 * `findUnique` initial avant que l'une des deux n'ait committe sa creation, la seconde voit son
 * `create` echouer avec `P2002` sur `@@unique([siteId, code])` — la contrainte en base est
 * l'arbitre final, jamais l'application seule. Cette transaction ayant ete annulee par Postgres
 * a l'echec de la contrainte, le rattrapage se fait HORS de cette transaction (une transaction
 * avortee ne peut plus etre reutilisee pour une requete de lecture) : un unique retry
 * deterministe relit l'entree desormais committee par la premiere requete, puis cree le
 * `PostePrevision` en la reutilisant.
 */
export async function createPostePrevision(
  scenarioId: string,
  siteId: string,
  data: CreatePostePrevisionDTO
) {
  assertEntierColonneInt(data.ordre, "ordre");

  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    select: { id: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }

  const code = sluggifierLibellePoste(data.libelle);

  try {
    return await prisma.$transaction(async (tx) => {
      const posteReferentielId = await resoudrePosteReferentielIdDansTransaction(
        tx,
        siteId,
        code,
        data.libelle
      );

      return tx.postePrevision.create({
        data: {
          scenarioId,
          libelle: data.libelle,
          type: data.type,
          inclusBaseRepartition: data.inclusBaseRepartition ?? true,
          ordre: data.ordre,
          siteId,
          posteReferentielId,
        },
      });
    });
  } catch (error) {
    if (!estCollisionUniciteCodeReferentiel(error)) {
      throw error;
    }

    // Un seul retry deterministe (R4) : l'entree PosteReferentiel vient d'etre committee par
    // la requete concurrente gagnante, hors de la transaction avortee ci-dessus.
    const referentiel = await prisma.posteReferentiel.findUnique({
      where: { siteId_code: { siteId, code } },
    });
    if (!referentiel) {
      // Ne peut arriver que si l'entree cree-puis-supprimee entre les deux requetes — aucune
      // route de suppression n'existe (§16.5) : ce cas ne devrait jamais survenir en pratique.
      throw error;
    }
    if (!referentiel.actif) {
      throw new BusinessRuleError(
        `Un poste referentiel desactive existe deja pour ce libelle ("${referentiel.libelle}"). ` +
          `Reactivez-le ou choisissez un libelle different plutot que d'en creer un doublon.`,
        409,
        "POSTE_REFERENTIEL_INACTIF"
      );
    }

    return prisma.postePrevision.create({
      data: {
        scenarioId,
        libelle: data.libelle,
        type: data.type,
        inclusBaseRepartition: data.inclusBaseRepartition ?? true,
        ordre: data.ordre,
        siteId,
        posteReferentielId: referentiel.id,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// ChargeMensuellePrevue
// ---------------------------------------------------------------------------

/**
 * Liste les ChargeMensuellePrevue d'un scenario, avec filtre optionnel sur
 * un seul mois (evite de tout charger pour un simple formulaire d'un mois).
 */
export async function getChargesMensuellesParScenario(
  scenarioId: string,
  siteId: string,
  moisAbsolu?: number
) {
  return prisma.chargeMensuellePrevue.findMany({
    where: {
      scenarioId,
      siteId,
      ...(moisAbsolu !== undefined && { moisAbsolu }),
    },
    orderBy: [{ moisAbsolu: "asc" }, { posteId: "asc" }],
  });
}

/**
 * Cree ou met a jour le montant d'un poste pour un mois absolu donne.
 * `upsert` sur `@@unique([posteId, moisAbsolu])` — operation naturellement
 * atomique (R4), pas besoin de transaction explicite (contrairement a un
 * remplacement en bloc multi-lignes).
 */
export async function upsertChargeMensuelle(
  posteId: string,
  siteId: string,
  moisAbsolu: number,
  montantFCFA: number
) {
  assertEntierColonneInt(moisAbsolu, "moisAbsolu");

  const poste = await prisma.postePrevision.findFirst({
    where: { id: posteId, siteId },
    select: { id: true, scenarioId: true },
  });
  if (!poste) {
    throw new Error("PostePrevision introuvable");
  }

  return prisma.chargeMensuellePrevue.upsert({
    where: { posteId_moisAbsolu: { posteId, moisAbsolu } },
    create: {
      scenarioId: poste.scenarioId,
      posteId,
      moisAbsolu,
      montantFCFA,
      siteId,
    },
    update: { montantFCFA },
  });
}

/**
 * Reporte un meme montant sur une plage de mois consecutifs pour un poste
 * (Sprint PR2-ter, story PR2ter.1) — R4 : une SEULE `prisma.$transaction`
 * enveloppant tous les upserts de la plage, jamais une boucle d'appels
 * independants a `upsertChargeMensuelle` depuis la route (cela recreerait le
 * risque d'ecriture partielle que cette fonction existe pour eviter : des
 * charges annoncees "rigoureusement constantes" par l'utilisateur ne
 * doivent jamais finir dans un etat ou seuls certains mois de la plage ont
 * ete mis a jour).
 *
 * Un `upsert` par mois reste necessaire (la contrainte `@@unique([posteId,
 * moisAbsolu])` empeche un `createMany` brut de gerer le cas deja-existant) —
 * l'atomicite vient de l'enveloppe `$transaction`, pas d'une ecriture en
 * bloc unique.
 *
 * Retourne le tableau des lignes creees/mises a jour, tries par
 * `moisAbsolu` croissant, pour que le client remplace directement son etat
 * local sans refetch complet.
 */
export async function reporterChargeMensuelle(
  posteId: string,
  siteId: string,
  montantFCFA: number,
  moisDebutAbsolu: number,
  moisFinAbsolu: number
) {
  assertEntierColonneInt(moisDebutAbsolu, "moisDebutAbsolu");
  assertEntierColonneInt(moisFinAbsolu, "moisFinAbsolu");
  if (moisFinAbsolu < moisDebutAbsolu) {
    throw new Error("moisFinAbsolu doit etre superieur ou egal a moisDebutAbsolu.");
  }

  return prisma.$transaction(async (tx) => {
    const poste = await tx.postePrevision.findFirst({
      where: { id: posteId, siteId },
      select: { id: true, scenarioId: true },
    });
    if (!poste) {
      throw new Error("PostePrevision introuvable");
    }

    const lignes = [];
    for (let moisAbsolu = moisDebutAbsolu; moisAbsolu <= moisFinAbsolu; moisAbsolu++) {
      const ligne = await tx.chargeMensuellePrevue.upsert({
        where: { posteId_moisAbsolu: { posteId, moisAbsolu } },
        create: {
          scenarioId: poste.scenarioId,
          posteId,
          moisAbsolu,
          montantFCFA,
          siteId,
        },
        update: { montantFCFA },
      });
      lignes.push(ligne);
    }
    return lignes;
  });
}

// ---------------------------------------------------------------------------
// JournalDepensePrevue
// ---------------------------------------------------------------------------

/**
 * Liste le journal de depenses d'un scenario, avec filtrage optionnel par
 * `vaguePrevueId` (affectee/non affectee — important pour `base_repartition`,
 * ADR-053 decision 6). `vaguePrevueId: null` explicite filtre les lignes
 * GENERALES (non affectees) ; `undefined` (absent du filtre) ne filtre pas.
 */
export async function getJournalDepensesParScenario(
  scenarioId: string,
  siteId: string,
  filters?: { vaguePrevueId?: string | null; categorie?: CategorieJournalPrevu }
) {
  return prisma.journalDepensePrevue.findMany({
    where: {
      scenarioId,
      siteId,
      ...(filters?.vaguePrevueId !== undefined && { vaguePrevueId: filters.vaguePrevueId }),
      ...(filters?.categorie && { categorie: filters.categorie }),
    },
    orderBy: { date: "asc" },
  });
}

/** Cree une ligne de journal de depenses prevues. */
export async function createJournalDepensePrevue(
  scenarioId: string,
  siteId: string,
  data: CreateJournalDepensePrevueDTO
) {
  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    select: { id: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }

  return prisma.journalDepensePrevue.create({
    data: {
      scenarioId,
      date: new Date(data.date),
      libelle: data.libelle,
      categorie: data.categorie,
      montantFCFA: data.montantFCFA,
      vaguePrevueId: data.vaguePrevueId ?? null,
      siteId,
    },
  });
}

/** Met a jour une ligne de journal de depenses prevues (update cible, atomique). */
export async function updateJournalDepensePrevue(
  id: string,
  siteId: string,
  data: UpdateJournalDepensePrevueDTO
) {
  const { count } = await prisma.journalDepensePrevue.updateMany({
    where: { id, siteId },
    data: {
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.libelle !== undefined && { libelle: data.libelle }),
      ...(data.categorie !== undefined && { categorie: data.categorie }),
      ...(data.montantFCFA !== undefined && { montantFCFA: data.montantFCFA }),
      ...(data.vaguePrevueId !== undefined && { vaguePrevueId: data.vaguePrevueId }),
    },
  });
  if (count === 0) {
    throw new Error("Ligne de journal introuvable");
  }
  return prisma.journalDepensePrevue.findUniqueOrThrow({ where: { id } });
}

/** Supprime une ligne de journal de depenses prevues (suppression conditionnee sur siteId — R4). */
export async function deleteJournalDepensePrevue(id: string, siteId: string): Promise<void> {
  const { count } = await prisma.journalDepensePrevue.deleteMany({
    where: { id, siteId },
  });
  if (count === 0) {
    throw new Error("Ligne de journal introuvable");
  }
}

// ---------------------------------------------------------------------------
// ApportCapital
// ---------------------------------------------------------------------------

/** Liste les ApportCapital d'un scenario. */
export async function getApportsCapitalParScenario(scenarioId: string, siteId: string) {
  return prisma.apportCapital.findMany({
    where: { scenarioId, siteId },
    orderBy: { date: "asc" },
  });
}

/** Cree un ApportCapital. */
export async function createApportCapital(
  scenarioId: string,
  siteId: string,
  data: CreateApportCapitalDTO
) {
  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    select: { id: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }

  return prisma.apportCapital.create({
    data: {
      scenarioId,
      date: new Date(data.date),
      libelle: data.libelle,
      montantFCFA: data.montantFCFA,
      type: data.type,
      siteId,
    },
  });
}

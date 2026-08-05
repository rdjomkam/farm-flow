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

/**
 * Payload de `createPostePrevision` (ADR-053 §16.6/§16.12, story A.5 — contrat XOR ACTIVE).
 * `posteReferentielId` XOR `nouveauPosteReferentielLibelle` : exactement l'un des deux, jamais
 * les deux, jamais aucun des deux (verifie applicativement dans la fonction, 400 sinon — filet
 * de securite en plus de la validation Zod au niveau route, cf. `previsions.schema.ts`).
 *
 * Remplace le get-or-create silencieux de §16.11 (`resoudrePosteReferentielIdDansTransaction`,
 * retire — un seul appelant en production, confirme par grep exhaustif, ADR-053 §16.12 "Ce que
 * devient le get-or-create silencieux de §16.11").
 */
export interface CreatePostePrevisionDTO {
  libelle: string;
  type: TypePostePrevision;
  inclusBaseRepartition?: boolean;
  ordre: number;
  posteReferentielId?: string;
  nouveauPosteReferentielLibelle?: string;
}

/**
 * Reponse de `createPostePrevision` — le `PostePrevision` cree (avec son `posteReferentiel`
 * inclus, ADR-053 §16.12 point 2/3 de la liste des ecrans) plus `reutilise` : `true` si
 * `posteReferentielId` a ete fourni (branche a, selection explicite d'une entree existante),
 * `false` si `nouveauPosteReferentielLibelle` a effectivement cree une nouvelle entree (branche
 * b) — un simple reflet de la branche empruntee, plus un signal de reutilisation SILENCIEUSE
 * (ce comportement disparait avec le contrat XOR, la branche b renvoie toujours 409 sur
 * collision, jamais une reutilisation implicite).
 */
export interface CreatePostePrevisionResult {
  poste: Awaited<ReturnType<typeof creerPostePrevisionAvecReferentiel>>;
  reutilise: boolean;
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

/**
 * Selection Prisma commune pour `posteReferentiel` — utilisee partout ou un `PostePrevision`
 * est charge/cree/retourne, pour que le rattachement soit visible (ADR-053 §16.12, exigence A).
 */
const INCLUDE_POSTE_REFERENTIEL = {
  posteReferentiel: { select: { libelle: true, actif: true } },
} as const;

/** Liste les PostePrevision d'un scenario, ordonnes par `ordre`, avec le rattachement referentiel. */
export async function getPostesPrevisionParScenario(scenarioId: string, siteId: string) {
  return prisma.postePrevision.findMany({
    where: { scenarioId, siteId },
    orderBy: { ordre: "asc" },
    include: INCLUDE_POSTE_REFERENTIEL,
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

/** Construit le payload `details.posteReferentielExistant` porte par les 409 (ADR-053 §16.12). */
function posteReferentielExistantDetails(entry: { id: string; libelle: string }) {
  return { posteReferentielExistant: { id: entry.id, libelle: entry.libelle } };
}

/**
 * Branche (a) du contrat XOR — `posteReferentielId` fourni (ADR-053 §16.12 "Contrat des
 * routes"). L'entree doit exister DANS LE SITE COURANT (sinon 404, jamais 403 — ne jamais
 * reveler l'existence d'une ressource d'un autre site) et etre ACTIVE (sinon 409). Aucune
 * creation, aucun appel a `sluggifierLibellePoste`.
 *
 * @throws {BusinessRuleError} 404 POSTE_REFERENTIEL_INTROUVABLE si absente ou d'un autre site.
 * @throws {BusinessRuleError} 409 POSTE_REFERENTIEL_INACTIF si desactivee.
 */
async function resoudreBranchePosteReferentielExistant(
  tx: PrismaTransactionClient,
  siteId: string,
  posteReferentielId: string
): Promise<{ posteReferentielId: string; reutilise: true }> {
  const referentiel = await tx.posteReferentiel.findFirst({
    where: { id: posteReferentielId, siteId },
  });
  if (!referentiel) {
    throw new BusinessRuleError(
      "Entree referentiel introuvable.",
      404,
      "POSTE_REFERENTIEL_INTROUVABLE"
    );
  }
  if (!referentiel.actif) {
    throw new BusinessRuleError(
      `Entree referentiel desactivee ("${referentiel.libelle}"). Reactivez-la avant de lier ` +
        `un poste, ou choisissez une entree active.`,
      409,
      "POSTE_REFERENTIEL_INACTIF",
      posteReferentielExistantDetails(referentiel)
    );
  }
  return { posteReferentielId: referentiel.id, reutilise: true };
}

/**
 * Branche (b) du contrat XOR — `nouveauPosteReferentielLibelle` fourni (ADR-053 §16.12
 * "Contrat des routes"). Slugifie le libelle, refuse explicitement toute collision (active OU
 * desactivee) — JAMAIS un suffixe numerique auto-genere, JAMAIS une reutilisation silencieuse.
 *
 * @throws {BusinessRuleError} 409 POSTE_REFERENTIEL_CODE_COLLISION si le slug collide avec une
 *   entree ACTIVE du site.
 * @throws {BusinessRuleError} 409 POSTE_REFERENTIEL_INACTIF si le slug collide avec une entree
 *   DESACTIVEE du site.
 */
async function resoudreBrancheNouveauPosteReferentiel(
  tx: PrismaTransactionClient,
  siteId: string,
  nouveauLibelle: string
): Promise<{ posteReferentielId: string; reutilise: false }> {
  const code = sluggifierLibellePoste(nouveauLibelle);
  const existant = await tx.posteReferentiel.findUnique({
    where: { siteId_code: { siteId, code } },
  });

  if (existant) {
    if (existant.actif) {
      throw new BusinessRuleError(
        `Un poste referentiel actif existe deja pour ce libelle ("${existant.libelle}"). ` +
          `Liez-le plutot que d'en creer un doublon.`,
        409,
        "POSTE_REFERENTIEL_CODE_COLLISION",
        posteReferentielExistantDetails(existant)
      );
    }
    throw new BusinessRuleError(
      `Un poste referentiel desactive existe deja pour ce libelle ("${existant.libelle}"). ` +
        `Reactivez-le avant de creer un doublon, ou choisissez un libelle different.`,
      409,
      "POSTE_REFERENTIEL_INACTIF",
      posteReferentielExistantDetails(existant)
    );
  }

  // `actif` explicite (redondant avec le defaut du schema Prisma @default(true), mais
  // volontaire, R7) : la valeur creee doit etre sans ambiguite pour tout consommateur qui lit
  // cette ligne, y compris un mock de test qui n'applique pas les defauts du schema.
  const cree = await tx.posteReferentiel.create({
    data: { siteId, code, libelle: nouveauLibelle, actif: true },
  });
  return { posteReferentielId: cree.id, reutilise: false };
}

/** Cree le `PostePrevision` avec son `posteReferentiel` inclus — un seul point d'ecriture. */
async function creerPostePrevisionAvecReferentiel(
  tx: PrismaTransactionClient,
  scenarioId: string,
  siteId: string,
  data: CreatePostePrevisionDTO,
  posteReferentielId: string
) {
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
    include: INCLUDE_POSTE_REFERENTIEL,
  });
}

/**
 * Cree un PostePrevision — contrat XOR ACTIVE (ADR-053 §16.6/§16.10/§16.12, story A.5).
 * Remplace le get-or-create silencieux de §16.11 : la resolution du `posteReferentielId`
 * exige desormais EXACTEMENT l'un des deux champs `posteReferentielId` (branche a, selection
 * explicite d'une entree active existante du site) OU `nouveauPosteReferentielLibelle`
 * (branche b, creation explicite) — jamais les deux, jamais aucun des deux (400).
 *
 * R4 : tout se passe dans la MEME transaction Prisma que la creation du `PostePrevision`
 * (jamais une entree referentiel creee puis un echec de creation du poste, qui laisserait une
 * entree orpheline sans poste).
 *
 * Concurrence (R4, §16.12 "Concurrence" — DIVERGENCE EXPLICITE d'avec §16.11) : si le `create`
 * de la branche (b) echoue avec `P2002` sur `@@unique([siteId, code])` (course entre deux
 * creations concomitantes), le comportement N'EST PLUS de rattraper silencieusement en
 * reutilisant l'entree committee par la requete gagnante — la seconde requete voulait CREER,
 * pas SELECTIONNER. Un seul retry de LECTURE, deterministe, jamais de boucle non bornee, mais
 * son issue est desormais TOUJOURS un 409 POSTE_REFERENTIEL_CODE_COLLISION, jamais un succes
 * silencieux.
 *
 * @throws {BusinessRuleError} 400 POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS si les deux champs XOR
 *   sont fournis. Filet de securite en plus de la validation Zod cote route.
 * @throws {BusinessRuleError} 400 POSTE_REFERENTIEL_CHAMP_REQUIS si aucun des deux n'est fourni.
 * @throws {BusinessRuleError} 404 POSTE_REFERENTIEL_INTROUVABLE (branche a, entree absente/autre site).
 * @throws {BusinessRuleError} 409 POSTE_REFERENTIEL_INACTIF (branche a ou b, entree desactivee).
 * @throws {BusinessRuleError} 409 POSTE_REFERENTIEL_CODE_COLLISION (branche b, slug deja pris
 *   par une entree active — synchrone ou issu d'une course concurrente).
 */
export async function createPostePrevision(
  scenarioId: string,
  siteId: string,
  data: CreatePostePrevisionDTO
): Promise<CreatePostePrevisionResult> {
  assertEntierColonneInt(data.ordre, "ordre");

  const aPosteReferentielId = !!data.posteReferentielId;
  const aNouveauLibelle = !!data.nouveauPosteReferentielLibelle?.trim();

  if (aPosteReferentielId && aNouveauLibelle) {
    throw new BusinessRuleError(
      "Choisissez soit une entree referentiel existante, soit un nouveau libelle — pas les deux.",
      400,
      "POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS"
    );
  }
  if (!aPosteReferentielId && !aNouveauLibelle) {
    throw new BusinessRuleError(
      "Selectionnez une entree du referentiel ou creez-en une nouvelle.",
      400,
      "POSTE_REFERENTIEL_CHAMP_REQUIS"
    );
  }

  const scenario = await prisma.scenarioPrevision.findFirst({
    where: { id: scenarioId, siteId },
    select: { id: true },
  });
  if (!scenario) {
    throw new Error("Scenario introuvable");
  }

  if (aPosteReferentielId) {
    // Branche (a) : aucune ecriture sur PosteReferentiel, donc aucun risque de P2002 — pas de
    // retry necessaire, une seule transaction couvre la lecture de verification + la creation.
    return prisma.$transaction(async (tx) => {
      const { posteReferentielId, reutilise } = await resoudreBranchePosteReferentielExistant(
        tx,
        siteId,
        data.posteReferentielId!
      );
      const poste = await creerPostePrevisionAvecReferentiel(
        tx,
        scenarioId,
        siteId,
        data,
        posteReferentielId
      );
      return { poste, reutilise };
    });
  }

  // Branche (b).
  try {
    return await prisma.$transaction(async (tx) => {
      const { posteReferentielId, reutilise } = await resoudreBrancheNouveauPosteReferentiel(
        tx,
        siteId,
        data.nouveauPosteReferentielLibelle!
      );
      const poste = await creerPostePrevisionAvecReferentiel(
        tx,
        scenarioId,
        siteId,
        data,
        posteReferentielId
      );
      return { poste, reutilise };
    });
  } catch (error) {
    if (!estCollisionUniciteCodeReferentiel(error)) {
      throw error;
    }

    // Course concurrente (R4, §16.12 "Concurrence") : la transaction ci-dessus a ete annulee par
    // Postgres a l'echec de la contrainte — le rattrapage se fait HORS de cette transaction (une
    // transaction avortee ne peut plus etre reutilisee pour une requete de lecture). Un unique
    // retry de lecture relit l'entree desormais committee par la requete gagnante, puis repond
    // TOUJOURS 409 (jamais une reutilisation silencieuse — divergence explicite d'avec §16.11).
    const code = sluggifierLibellePoste(data.nouveauPosteReferentielLibelle!);
    const referentiel = await prisma.posteReferentiel.findUnique({
      where: { siteId_code: { siteId, code } },
    });
    if (!referentiel) {
      // Ne peut arriver que si l'entree cree-puis-supprimee entre les deux requetes — aucune
      // route de suppression n'existe (§16.5) : ce cas ne devrait jamais survenir en pratique.
      throw error;
    }
    throw new BusinessRuleError(
      `Un poste referentiel actif existe deja pour ce libelle ("${referentiel.libelle}"). ` +
        `Liez-le plutot que d'en creer un doublon.`,
      409,
      "POSTE_REFERENTIEL_CODE_COLLISION",
      posteReferentielExistantDetails(referentiel)
    );
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

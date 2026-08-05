/**
 * src/lib/queries/__tests__/previsions-fake-db.ts
 *
 * Fake Prisma en memoire, partage par les tests unitaires du module
 * Previsions (Sprint PR2, story PR2.1 — tests). Pattern deja utilise dans
 * `src/__tests__/queries/su12-numero-unique-par-site.test.ts` (magasins en
 * memoire par table + mocks des methodes Prisma), generalise ici pour
 * couvrir les 12 modeles Previsions sans dupliquer le meme boilerplate
 * 5 fois (previsions-scenarios, previsions-aliments, previsions-vagues,
 * previsions-charges, previsions-scenario-loader).
 *
 * Ce que ce fake db PROUVE : le comportement de la couche requete
 * (filtrage siteId — R8, remplacement en bloc — R4, validations bloquantes
 * AVANT ecriture). Ce que ce fake db NE PROUVE PAS : le comportement reel
 * de PostgreSQL (contraintes @unique, cascades onDelete, verrouillage —
 * cf. ERR-103 leçon (e), meme principe applique ici : on ne mocke pas "le
 * moteur qu'on est cense tester" — Postgres n'est PAS le sujet de ces
 * tests, la logique applicative des queries l'est). La preuve DB reelle
 * (contrainte @unique sur Vague.vaguePrevueId, rejet Int fractionnaire) est
 * couverte separement par des tests DB-gated (`requireDatabaseUrl()`).
 *
 * `$transaction(async (tx) => ...)` : snapshot profond de tous les magasins
 * AVANT d'invoquer le callback ; si le callback rejette, les magasins sont
 * restaures a l'identique (rollback) — sinon le snapshot est simplement
 * abandonne (commit implicite, les ecritures ont deja mute les magasins).
 * Cela reproduit fidelement la semantique attendue par R4 : une exception
 * levee au milieu d'une transaction ne doit laisser AUCUNE trace.
 */
import { vi } from "vitest";

export interface FakeRow {
  id: string;
  [key: string]: unknown;
}

export interface Stores {
  scenarioPrevision: FakeRow[];
  parametresPrevision: FakeRow[];
  palierRemise: FakeRow[];
  alimentPrevision: FakeRow[];
  alimentArticlePrevision: FakeRow[];
  repartitionMoisAliment: FakeRow[];
  vaguePrevue: FakeRow[];
  alimentParVaguePrevue: FakeRow[];
  vague: FakeRow[];
  produit: FakeRow[];
  postePrevision: FakeRow[];
  // ADR-053 §16 (story A.4) — get-or-create transactionnel dans createPostePrevision
  posteReferentiel: FakeRow[];
  chargeMensuellePrevue: FakeRow[];
  journalDepensePrevue: FakeRow[];
  apportCapital: FakeRow[];
}

export function createEmptyStores(): Stores {
  return {
    scenarioPrevision: [],
    parametresPrevision: [],
    palierRemise: [],
    alimentPrevision: [],
    alimentArticlePrevision: [],
    repartitionMoisAliment: [],
    vaguePrevue: [],
    alimentParVaguePrevue: [],
    vague: [],
    produit: [],
    postePrevision: [],
    posteReferentiel: [],
    chargeMensuellePrevue: [],
    journalDepensePrevue: [],
    apportCapital: [],
  };
}

/** Cles composites `@@unique`/`@unique` reellement interrogees par les queries sous test. */
const COMPOSITE_KEYS: Record<string, string[]> = {
  siteId_code: ["siteId", "code"],
  scenarioId_code: ["scenarioId", "code"],
  alimentPrevisionId_moisCycle: ["alimentPrevisionId", "moisCycle"],
  vaguePrevueId_alimentPrevisionId_moisCycle: [
    "vaguePrevueId",
    "alimentPrevisionId",
    "moisCycle",
  ],
  posteId_moisAbsolu: ["posteId", "moisAbsolu"],
  scenarioId_libelle: ["scenarioId", "libelle"],
};

/**
 * Filtres de relation "est nul" simules pour les modeles/champs reellement
 * interroges par les queries sous test (ex. `vaguePrevue: { vague: null }` —
 * `annulerVaguePrevue`, R4, cf. `previsions-vagues.ts`). `vague` n'est PAS un
 * champ stocke sur la ligne `vaguePrevue` (relation inverse de
 * `Vague.vaguePrevueId`) : sans ce registre, `row["vague"]` vaudrait
 * `undefined` et ne matcherait jamais `null`, cassant le filtre.
 */
const RELATION_NULL_CHECKS: Record<
  string,
  (row: FakeRow, stores: Stores) => boolean
> = {
  "vaguePrevue.vague": (row, stores) => !stores.vague.some((v) => v.vaguePrevueId === row.id),
};

function matchWhere(
  row: FakeRow,
  where: Record<string, unknown> | undefined,
  context?: { modelName: keyof Stores; stores: Stores }
): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === "NOT") {
      if (matchWhere(row, val as Record<string, unknown>, context)) return false;
      continue;
    }
    if (context && val === null) {
      const relationCheck = RELATION_NULL_CHECKS[`${String(context.modelName)}.${key}`];
      if (relationCheck) {
        if (!relationCheck(row, context.stores)) return false;
        continue;
      }
    }
    if (COMPOSITE_KEYS[key]) {
      const fields = COMPOSITE_KEYS[key];
      const composite = val as Record<string, unknown>;
      for (const f of fields) {
        if (row[f] !== composite[f]) return false;
      }
      continue;
    }
    if (val && typeof val === "object" && !Array.isArray(val) && "in" in (val as object)) {
      const list = (val as { in: unknown[] }).in;
      if (!list.includes(row[key])) return false;
      continue;
    }
    if (row[key] !== val) return false;
  }
  return true;
}

function applyOrderBy(rows: FakeRow[], orderBy: unknown): FakeRow[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses as Record<string, "asc" | "desc">[]) {
      for (const [field, dir] of Object.entries(clause)) {
        const av = a[field] as number | string | Date;
        const bv = b[field] as number | string | Date;
        if (av === bv) continue;
        const cmp = av < bv ? -1 : 1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

let idCounter = 0;
function nextId(model: string): string {
  idCounter += 1;
  return `fake-${model}-${idCounter}`;
}

/**
 * Cree un objet "model" expose sous `prisma.<model>` / `tx.<model>`, avec les
 * methodes CRUD reellement utilisees par les fichiers sous test. Le
 * parametre `includeResolvers` attache les relations demandees par `include`
 * (specifiques a chaque modele, cf. schema Prisma).
 */
function createModel(
  stores: Stores,
  modelName: keyof Stores,
  includeResolvers: Record<string, (row: FakeRow, stores: Stores) => unknown> = {}
) {
  const rows = () => stores[modelName];
  const match = (r: FakeRow, where: Record<string, unknown> | undefined) =>
    matchWhere(r, where, { modelName, stores });

  function attachIncludes(row: FakeRow, include: Record<string, unknown> | undefined): FakeRow {
    if (!include) return row;
    const result = { ...row };
    for (const key of Object.keys(include)) {
      const resolver = includeResolvers[key];
      if (resolver) {
        result[key] = resolver(row, stores);
      }
    }
    return result;
  }

  return {
    async findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      include?: Record<string, unknown>;
      take?: number;
      skip?: number;
    } = {}) {
      let filtered = rows().filter((r) => match(r, args.where));
      filtered = applyOrderBy(filtered, args.orderBy);
      if (args.skip) filtered = filtered.slice(args.skip);
      if (args.take !== undefined) filtered = filtered.slice(0, args.take);
      return filtered.map((r) => attachIncludes(r, args.include));
    },
    async findFirst(args: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
      include?: Record<string, unknown>;
    } = {}) {
      const found = rows().find((r) => match(r, args.where));
      if (!found) return null;
      const withIncludes = attachIncludes(found, args.include);
      if (args.select) {
        const selected: FakeRow = { id: found.id };
        for (const key of Object.keys(args.select)) {
          selected[key] = withIncludes[key];
        }
        return selected;
      }
      return withIncludes;
    },
    async findUnique(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) {
      const found = rows().find((r) => match(r, args.where));
      if (!found) return null;
      return attachIncludes(found, args.include);
    },
    async findUniqueOrThrow(args: {
      where: Record<string, unknown>;
      include?: Record<string, unknown>;
    }) {
      const found = rows().find((r) => match(r, args.where));
      if (!found) throw new Error(`${String(modelName)} not found`);
      return attachIncludes(found, args.include);
    },
    async create(args: { data: Record<string, unknown> }) {
      const row: FakeRow = { id: nextId(String(modelName)), ...args.data };
      rows().push(row);
      return row;
    },
    async createMany(args: { data: Record<string, unknown>[] }) {
      // Simule une violation de contrainte @@unique connue de ce modele —
      // suffisant pour prouver R4 (rollback declenche par une VRAIE erreur
      // d'ecriture, pas seulement par une validation applicative).
      const uniqueFields = UNIQUE_CONSTRAINTS[String(modelName)];
      if (uniqueFields) {
        const seen = new Set<string>();
        for (const d of args.data) {
          const key = uniqueFields.map((f) => d[f]).join("::");
          if (seen.has(key)) {
            throw new Error(
              `Unique constraint failed on ${String(modelName)} (${uniqueFields.join(", ")})`
            );
          }
          seen.add(key);
        }
      }
      const created = args.data.map((d) => ({ id: nextId(String(modelName)), ...d }));
      rows().push(...created);
      return { count: created.length };
    },
    async update(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const row = rows().find((r) => match(r, args.where));
      if (!row) throw new Error(`${String(modelName)} not found`);
      Object.assign(row, args.data);
      return row;
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const matching = rows().filter((r) => match(r, args.where));
      for (const row of matching) Object.assign(row, args.data);
      return { count: matching.length };
    },
    async upsert(args: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const row = rows().find((r) => match(r, args.where));
      if (row) {
        Object.assign(row, args.update);
        return row;
      }
      const created: FakeRow = { id: nextId(String(modelName)), ...args.create };
      rows().push(created);
      return created;
    },
    async deleteMany(args: { where?: Record<string, unknown> } = {}) {
      const matching = rows().filter((r) => match(r, args.where));
      const remaining = rows().filter((r) => !match(r, args.where));
      stores[modelName] = remaining;
      return { count: matching.length };
    },
    async delete(args: { where: Record<string, unknown> }) {
      const row = rows().find((r) => match(r, args.where));
      if (!row) throw new Error(`${String(modelName)} not found`);
      stores[modelName] = rows().filter((r) => r !== row);
      return row;
    },
    async count(args: { where?: Record<string, unknown> } = {}) {
      return rows().filter((r) => match(r, args.where)).length;
    },
  };
}

/** Contraintes `@@unique` simulees pour prouver un VRAI rejet d'ecriture (pas une validation applicative). */
const UNIQUE_CONSTRAINTS: Record<string, string[]> = {
  alimentParVaguePrevue: ["vaguePrevueId", "alimentPrevisionId", "moisCycle"],
  repartitionMoisAliment: ["alimentPrevisionId", "moisCycle"],
};

const INCLUDE_RESOLVERS: Record<keyof Stores, Record<string, (row: FakeRow, s: Stores) => unknown>> = {
  scenarioPrevision: {
    parametres: (row, s) => s.parametresPrevision.find((p) => p.scenarioId === row.id) ?? null,
    paliersRemise: (row, s) =>
      s.palierRemise
        .filter((p) => p.scenarioId === row.id)
        .sort((a, b) => (a.ordre as number) - (b.ordre as number)),
  },
  parametresPrevision: {},
  palierRemise: {},
  alimentPrevision: {
    repartitions: (row, s) =>
      s.repartitionMoisAliment
        .filter((r) => r.alimentPrevisionId === row.id)
        .sort((a, b) => (a.moisCycle as number) - (b.moisCycle as number)),
    articles: (row, s) =>
      s.alimentArticlePrevision
        .filter((a) => a.alimentCalibrePrevisionId === row.id)
        .sort((a, b) => (a.ordre as number) - (b.ordre as number)),
  },
  alimentArticlePrevision: {},
  repartitionMoisAliment: {},
  vaguePrevue: {
    alimentsParMois: (row, s) => s.alimentParVaguePrevue.filter((a) => a.vaguePrevueId === row.id),
    journal: (row, s) =>
      s.journalDepensePrevue
        .filter((j) => j.vaguePrevueId === row.id)
        .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime()),
    vague: (row, s) => s.vague.find((v) => v.vaguePrevueId === row.id) ?? null,
    enfantsScission: (row, s) => s.vaguePrevue.filter((v) => v.vaguePrevueParentId === row.id),
  },
  alimentParVaguePrevue: {},
  vague: {},
  produit: {},
  postePrevision: {
    chargesMensuelles: (row, s) =>
      s.chargeMensuellePrevue
        .filter((c) => c.posteId === row.id)
        .sort((a, b) => (a.moisAbsolu as number) - (b.moisAbsolu as number)),
  },
  posteReferentiel: {},
  chargeMensuellePrevue: {},
  journalDepensePrevue: {},
  apportCapital: {},
};

function deepCloneStores(stores: Stores): Stores {
  const clone = {} as Stores;
  for (const key of Object.keys(stores) as (keyof Stores)[]) {
    clone[key] = stores[key].map((r) => ({ ...r }));
  }
  return clone;
}

function restoreStores(target: Stores, snapshot: Stores): void {
  for (const key of Object.keys(target) as (keyof Stores)[]) {
    target[key] = snapshot[key];
  }
}

/**
 * Construit l'objet mocke `prisma` complet (avec `$transaction` a semantique
 * de rollback reel sur throw), pret a etre retourne par `vi.mock("@/lib/db")`.
 */
export function buildFakePrisma(stores: Stores) {
  const models = Object.fromEntries(
    (Object.keys(stores) as (keyof Stores)[]).map((modelName) => [
      modelName,
      createModel(stores, modelName, INCLUDE_RESOLVERS[modelName]),
    ])
  );

  return {
    ...models,
    async $transaction(fn: (tx: unknown) => unknown) {
      const snapshot = deepCloneStores(stores);
      const tx = Object.fromEntries(
        (Object.keys(stores) as (keyof Stores)[]).map((modelName) => [
          modelName,
          createModel(stores, modelName, INCLUDE_RESOLVERS[modelName]),
        ])
      );
      try {
        return await fn(tx);
      } catch (err) {
        restoreStores(stores, snapshot);
        throw err;
      }
    },
  };
}

/** Helper pour un test qui a besoin d'espionner les appels sans les mocker completement (non utilise partout, dispo si besoin). */
export function spyOnModel<T extends object>(model: T): T {
  const spied = {} as T;
  for (const key of Object.keys(model) as (keyof T)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spied[key] = vi.fn(model[key] as any) as any;
  }
  return spied;
}

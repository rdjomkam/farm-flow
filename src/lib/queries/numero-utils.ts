import { prisma } from "@/lib/db";

/**
 * Type for a Prisma interactive-transaction client.
 * Extracts the `tx` parameter from `prisma.$transaction(async (tx) => …)`.
 */
type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Model names that support auto-generated `numero`/`code` fields.
 * Maps to the Prisma delegate used for `findFirst`.
 */
export type NumeroModel =
  | "depense"
  | "commande"
  | "vente"
  | "facture"
  | "bonLivraison"
  | "ponte"
  | "incubation"
  | "lotGeniteurs"
  | "listeBesoins"
  | "lotAlevins";

export interface GenerateNextNumeroOptions {
  /** Champ portant le numero auto-genere. Defaut : "numero". */
  field?: "numero" | "code";
  /**
   * Le prefixe inclut-il l'annee courante (format "{prefix}-{YYYY}-{NNN}") ?
   * false pour les formats sans annee (ex. LotGeniteurs "LG-F-{NNN}"). Defaut : true.
   */
  includeYear?: boolean;
}

/**
 * Génère le prochain `numero`/`code` séquentiel pour un modèle+préfixe+site donné,
 * de façon atomique et sûre en concurrence.
 *
 * Mécanisme anti-collision (SU.3) :
 * Deux transactions concurrentes peuvent lire le même `max(numero)` en isolation
 * Read Committed avant que l'une des deux ne commit — la contrainte `@unique`
 * transforme alors la collision en erreur P2002 (voir `handleApiError`, qui la
 * traduit en 409 avec un message actionnable pour l'utilisateur).
 *
 * Pour éliminer la race à la source, un verrou consultatif Postgres
 * (`pg_advisory_xact_lock`) est posé AVANT la lecture du dernier numero, avec une
 * clé dérivée de la portée réelle du compteur (modèle + préfixe + site [+ année]).
 * Deux portées différentes (ex. deux sites, deux années, ou LG-F- vs LG-M-) ne se
 * bloquent donc jamais mutuellement.
 *
 * IMPORTANT : `pg_advisory_xact_lock` se libère automatiquement au commit/rollback
 * de la transaction — le paramètre `tx` DOIT être le client transactionnel réel
 * (celui reçu dans `prisma.$transaction(async (tx) => …)`), jamais le client
 * global `prisma`. Passer le client global rendrait le verrou inopérant (il se
 * libèrerait immédiatement après la requête, sans jamais couvrir la fenêtre entre
 * la lecture du dernier numero et l'écriture de la nouvelle ligne).
 *
 * Format par défaut : `{prefix}-{YYYY}-{NNN}` (ex. `DEP-2026-042`).
 * Format sans année (`includeYear: false`) : `{prefix}-{NNN}` (ex. `LG-F-001`,
 * le préfixe complet incluant déjà tout segment fixe comme le sexe).
 */
export async function generateNextNumero(
  tx: PrismaTransactionClient,
  model: NumeroModel,
  prefix: string,
  siteId: string,
  opts?: GenerateNextNumeroOptions
): Promise<string> {
  const field = opts?.field ?? "numero";
  const includeYear = opts?.includeYear ?? true;
  const year = new Date().getFullYear();
  const pattern = includeYear ? `${prefix}-${year}-` : `${prefix}-`;

  // Clé de verrou dérivée de la portée réelle du compteur : modèle + pattern +
  // siteId. Le pattern inclut déjà le préfixe (et le sexe pour LotGeniteurs,
  // qui est encodé dans le préfixe : "LG-F" / "LG-M") et l'année si applicable.
  const lockKey = `numero:${model}:${pattern}:${siteId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = await (tx[model] as any).findFirst({
    where: { siteId, [field]: { startsWith: pattern } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  });

  let seq = 1;
  if (last) {
    const value = (last as Record<string, string>)[field];
    // Extraction robuste : tout ce qui suit le pattern est le segment séquentiel,
    // quel que soit le nombre de segments du préfixe (avec ou sans année).
    const seqPart = value.slice(pattern.length);
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${pattern}${String(seq).padStart(3, "0")}`;
}

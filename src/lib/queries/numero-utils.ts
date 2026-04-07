import { prisma } from "@/lib/db";

/**
 * Type for a Prisma interactive-transaction client.
 * Extracts the `tx` parameter from `prisma.$transaction(async (tx) => …)`.
 */
type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/**
 * Model names that support auto-generated `numero` fields.
 * Maps to the Prisma delegate used for `findFirst`.
 */
type NumeroModel = "depense" | "commande" | "vente" | "facture";

/**
 * Generate the next sequential `numero` for a given model+prefix+site.
 *
 * Uses `findFirst + orderBy desc + parse` instead of `count() + 1`
 * to avoid race conditions when two transactions run concurrently.
 *
 * Format: `{prefix}-{YYYY}-{NNN}` (e.g. `DEP-2026-042`).
 */
export async function generateNextNumero(
  tx: PrismaTransactionClient,
  model: NumeroModel,
  prefix: string,
  siteId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = await (tx[model] as any).findFirst({
    where: { siteId, numero: { startsWith: pattern } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  let seq = 1;
  if (last) {
    const parts = (last as { numero: string }).numero.split("-");
    seq = (parseInt(parts[2], 10) || 0) + 1;
  }

  return `${pattern}${String(seq).padStart(3, "0")}`;
}

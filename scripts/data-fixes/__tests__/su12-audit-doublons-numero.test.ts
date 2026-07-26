/**
 * Test unitaire — SU.12 : preuve que le script d'audit de doublons
 * (siteId, numero|code) construit correctement la requête GROUP BY / HAVING
 * et interprète son résultat, sans se connecter à aucune base de données
 * réelle (Pool `pg` mocké — voir pattern
 * scripts/data-fixes/__tests__/px-audit-signatures-corrompues.test.ts).
 */

import { describe, it, expect, vi } from "vitest";
import { findDoublons } from "../su12-audit-doublons-numero";

function makeFakePool(rows: Array<Record<string, unknown>>) {
  return {
    query: vi.fn(async (sql: string) => {
      expect(sql).toMatch(/GROUP BY "siteId"/);
      expect(sql).toMatch(/HAVING count\(\*\) > 1/);
      return { rows };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("findDoublons — SU.12 audit doublons (siteId, numero|code)", () => {
  it("retourne un tableau vide quand la requête ne renvoie aucune ligne (cas nominal)", async () => {
    const pool = makeFakePool([]);
    const result = await findDoublons(pool, { table: "Facture", field: "numero" });
    expect(result).toEqual([]);
  });

  it("mappe correctement les colonnes de la requête vers DoublonRow", async () => {
    const pool = makeFakePool([
      {
        siteId: "site-A",
        valeur: "FAC-2026-001",
        count: 2,
        ids: ["facture-1", "facture-2"],
      },
    ]);

    const result = await findDoublons(pool, { table: "Facture", field: "numero" });

    expect(result).toEqual([
      {
        table: "Facture",
        field: "numero",
        siteId: "site-A",
        valeur: "FAC-2026-001",
        count: 2,
        ids: ["facture-1", "facture-2"],
      },
    ]);
  });

  it("supporte le champ `code` (Ponte/Incubation/LotGeniteurs)", async () => {
    const pool = makeFakePool([
      { siteId: "site-B", valeur: "LG-F-001", count: 3, ids: ["lg-1", "lg-2", "lg-3"] },
    ]);

    const result = await findDoublons(pool, { table: "LotGeniteurs", field: "code" });

    expect(result[0].field).toBe("code");
    expect(result[0].table).toBe("LotGeniteurs");
    expect(result[0].count).toBe(3);
  });

  it("interroge la bonne table dans le SQL généré", async () => {
    const pool = makeFakePool([]);
    await findDoublons(pool, { table: "Incubation", field: "code" });

    const calledSql = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledSql).toContain('"Incubation"');
    expect(calledSql).toContain('"code"');
  });
});

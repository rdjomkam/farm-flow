/**
 * Tests unitaires — computeSiteStatus() (Story A.3)
 *
 * Couvre :
 * - ACTIVE : site actif sans suspension ni suppression
 * - SUSPENDED : site avec suspendedAt non null (isActive peut etre true)
 * - BLOCKED : site avec isActive=false sans suspension ni suppression
 * - ARCHIVED : site avec deletedAt non null (priorite absolue)
 * - Priorite ARCHIVED > SUSPENDED > BLOCKED > ACTIVE
 *
 * Importe depuis @/lib/site-modules-config et @/types.
 */

import { describe, it, expect } from "vitest";
import { computeSiteStatus } from "@/lib/site-modules-config";
import { SiteStatus } from "@/types";

// ---------------------------------------------------------------------------
// Cas nominaux — les 4 statuts
// ---------------------------------------------------------------------------

describe("computeSiteStatus — cas nominaux", () => {
  it("ACTIVE : isActive=true, pas de suspendedAt, pas de deletedAt", () => {
    expect(
      computeSiteStatus({ isActive: true, suspendedAt: null, deletedAt: null })
    ).toBe(SiteStatus.ACTIVE);
  });

  it("ACTIVE : isActive=true sans fournir suspendedAt ni deletedAt (undefined)", () => {
    expect(computeSiteStatus({ isActive: true })).toBe(SiteStatus.ACTIVE);
  });

  it("SUSPENDED : isActive=true, suspendedAt defini, pas de deletedAt", () => {
    expect(
      computeSiteStatus({
        isActive: true,
        suspendedAt: new Date(),
        deletedAt: null,
      })
    ).toBe(SiteStatus.SUSPENDED);
  });

  it("SUSPENDED : isActive=false, suspendedAt defini, pas de deletedAt", () => {
    // suspendedAt prend priorite sur isActive=false
    expect(
      computeSiteStatus({
        isActive: false,
        suspendedAt: new Date(),
        deletedAt: null,
      })
    ).toBe(SiteStatus.SUSPENDED);
  });

  it("BLOCKED : isActive=false, pas de suspendedAt, pas de deletedAt", () => {
    expect(
      computeSiteStatus({ isActive: false, suspendedAt: null, deletedAt: null })
    ).toBe(SiteStatus.BLOCKED);
  });

  it("BLOCKED : isActive=false sans fournir suspendedAt ni deletedAt", () => {
    expect(computeSiteStatus({ isActive: false })).toBe(SiteStatus.BLOCKED);
  });

  it("ARCHIVED : deletedAt defini, isActive=true, pas de suspendedAt", () => {
    expect(
      computeSiteStatus({
        isActive: true,
        suspendedAt: null,
        deletedAt: new Date(),
      })
    ).toBe(SiteStatus.ARCHIVED);
  });

  it("ARCHIVED : deletedAt defini, isActive=false, pas de suspendedAt", () => {
    expect(
      computeSiteStatus({
        isActive: false,
        suspendedAt: null,
        deletedAt: new Date(),
      })
    ).toBe(SiteStatus.ARCHIVED);
  });
});

// ---------------------------------------------------------------------------
// Cas limites — priorites entre statuts
// ---------------------------------------------------------------------------

describe("computeSiteStatus — priorites", () => {
  it("ARCHIVED prend priorite sur SUSPENDED (deletedAt et suspendedAt tous deux definis)", () => {
    expect(
      computeSiteStatus({
        isActive: true,
        suspendedAt: new Date(),
        deletedAt: new Date(),
      })
    ).toBe(SiteStatus.ARCHIVED);
  });

  it("ARCHIVED prend priorite sur BLOCKED (deletedAt defini, isActive=false)", () => {
    expect(
      computeSiteStatus({
        isActive: false,
        suspendedAt: null,
        deletedAt: new Date(),
      })
    ).toBe(SiteStatus.ARCHIVED);
  });

  it("ARCHIVED prend priorite sur tout (isActive=false, suspendedAt et deletedAt definis)", () => {
    expect(
      computeSiteStatus({
        isActive: false,
        suspendedAt: new Date(),
        deletedAt: new Date(),
      })
    ).toBe(SiteStatus.ARCHIVED);
  });

  it("SUSPENDED prend priorite sur BLOCKED (suspendedAt defini, isActive=false)", () => {
    // deja couvert dans les cas nominaux mais ici on insiste sur l'ordre
    expect(
      computeSiteStatus({
        isActive: false,
        suspendedAt: new Date("2025-01-15"),
        deletedAt: null,
      })
    ).toBe(SiteStatus.SUSPENDED);
  });
});

// ---------------------------------------------------------------------------
// Cas limites — types de valeurs pour les dates
// ---------------------------------------------------------------------------

describe("computeSiteStatus — types de valeurs pour les champs date", () => {
  it("accepte une string ISO pour suspendedAt", () => {
    expect(
      computeSiteStatus({
        isActive: true,
        suspendedAt: "2025-06-01T00:00:00Z",
        deletedAt: null,
      })
    ).toBe(SiteStatus.SUSPENDED);
  });

  it("accepte une string ISO pour deletedAt", () => {
    expect(
      computeSiteStatus({
        isActive: true,
        suspendedAt: null,
        deletedAt: "2025-06-01T00:00:00Z",
      })
    ).toBe(SiteStatus.ARCHIVED);
  });

  it("traite undefined comme null pour suspendedAt (pas de suspension)", () => {
    expect(
      computeSiteStatus({ isActive: true, suspendedAt: undefined, deletedAt: null })
    ).toBe(SiteStatus.ACTIVE);
  });

  it("traite undefined comme null pour deletedAt (pas d'archivage)", () => {
    expect(
      computeSiteStatus({ isActive: true, suspendedAt: null, deletedAt: undefined })
    ).toBe(SiteStatus.ACTIVE);
  });
});

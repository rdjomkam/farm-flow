import { SiteModule, SiteStatus } from "@/types";
import type { LucideIcon } from "lucide-react";
import {
  FlaskConical,
  Fish,
  Package,
  ShoppingCart,
  BarChart2,
  Boxes,
  Settings,
  HardHat,
  StickyNote,
} from "lucide-react";

export interface SiteModuleConfig {
  value: SiteModule;
  labelKey: string;
  icon: LucideIcon;
  level: "site";
}

export const SITE_MODULES_CONFIG: SiteModuleConfig[] = [
  { value: SiteModule.REPRODUCTION, labelKey: "Reproduction", icon: FlaskConical, level: "site" },
  { value: SiteModule.GROSSISSEMENT, labelKey: "Grossissement", icon: Fish, level: "site" },
  { value: SiteModule.INTRANTS, labelKey: "Intrants", icon: Package, level: "site" },
  { value: SiteModule.VENTES, labelKey: "Ventes", icon: ShoppingCart, level: "site" },
  { value: SiteModule.ANALYSE_PILOTAGE, labelKey: "Analyse & Pilotage", icon: BarChart2, level: "site" },
  { value: SiteModule.PACKS_PROVISIONING, labelKey: "Packs & Provisioning", icon: Boxes, level: "site" },
  { value: SiteModule.CONFIGURATION, labelKey: "Configuration", icon: Settings, level: "site" },
  { value: SiteModule.INGENIEUR, labelKey: "Ingenieur", icon: HardHat, level: "site" },
  { value: SiteModule.NOTES, labelKey: "Notes", icon: StickyNote, level: "site" },
];

export const SITE_TOGGLEABLE_MODULES = SITE_MODULES_CONFIG;

export function isModuleActive(module: SiteModule, enabledModules: SiteModule[]): boolean {
  const config = SITE_MODULES_CONFIG.find((m) => m.value === module);
  if (!config) return false;
  return enabledModules.includes(module);
}

/**
 * computeSiteStatus — calcule le statut d'un site a partir de ses champs.
 *
 * Logique (ADR-021 section 2.5) :
 *   deletedAt != null          → ARCHIVED
 *   suspendedAt != null        → SUSPENDED  (isActive peut etre true)
 *   !isActive                  → BLOCKED
 *   sinon                      → ACTIVE
 *
 * Cette fonction est pure (pas d'effet de bord) et testee unitairement
 * dans src/__tests__/lib/site-status.test.ts (Story A.3).
 *
 * @param site - sous-ensemble des champs Site necessaires au calcul
 * @returns SiteStatus calcule
 */
export function computeSiteStatus(site: {
  isActive: boolean;
  suspendedAt?: Date | string | null;
  deletedAt?: Date | string | null;
}): SiteStatus {
  if (site.deletedAt != null) {
    return SiteStatus.ARCHIVED;
  }
  if (site.suspendedAt != null) {
    return SiteStatus.SUSPENDED;
  }
  if (!site.isActive) {
    return SiteStatus.BLOCKED;
  }
  return SiteStatus.ACTIVE;
}

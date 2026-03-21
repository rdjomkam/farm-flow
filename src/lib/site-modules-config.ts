import { SiteModule } from "@/types";
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
  CreditCard,
  TrendingUp,
  Tag,
} from "lucide-react";

export interface SiteModuleConfig {
  value: SiteModule;
  labelKey: string;
  icon: LucideIcon;
  level: "site" | "platform";
}

export const SITE_MODULES_CONFIG: SiteModuleConfig[] = [
  // Site-level (toggleable by site admin)
  { value: SiteModule.REPRODUCTION, labelKey: "Reproduction", icon: FlaskConical, level: "site" },
  { value: SiteModule.GROSSISSEMENT, labelKey: "Grossissement", icon: Fish, level: "site" },
  { value: SiteModule.INTRANTS, labelKey: "Intrants", icon: Package, level: "site" },
  { value: SiteModule.VENTES, labelKey: "Ventes", icon: ShoppingCart, level: "site" },
  { value: SiteModule.ANALYSE_PILOTAGE, labelKey: "Analyse & Pilotage", icon: BarChart2, level: "site" },
  { value: SiteModule.PACKS_PROVISIONING, labelKey: "Packs & Provisioning", icon: Boxes, level: "platform" },
  { value: SiteModule.CONFIGURATION, labelKey: "Configuration", icon: Settings, level: "site" },
  { value: SiteModule.INGENIEUR, labelKey: "Ingenieur", icon: HardHat, level: "site" },
  { value: SiteModule.NOTES, labelKey: "Notes", icon: StickyNote, level: "site" },
  // Platform-level (always available, permission-gated only)
  { value: SiteModule.ABONNEMENTS, labelKey: "Abonnements", icon: CreditCard, level: "site" },
  { value: SiteModule.COMMISSIONS, labelKey: "Commissions", icon: TrendingUp, level: "platform" },
  { value: SiteModule.REMISES, labelKey: "Remises", icon: Tag, level: "platform" },
];

export const SITE_TOGGLEABLE_MODULES = SITE_MODULES_CONFIG.filter((m) => m.level === "site");
export const PLATFORM_MODULES = SITE_MODULES_CONFIG.filter((m) => m.level === "platform");

export function isModuleActive(module: SiteModule, enabledModules: SiteModule[], isPlatform?: boolean): boolean {
  const config = SITE_MODULES_CONFIG.find((m) => m.value === module);
  if (!config) return false;
  if (config.level === "platform") return isPlatform === true;
  return enabledModules.includes(module);
}

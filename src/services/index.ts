/**
 * Services client-side — couche d'abstraction sur les appels API fetch.
 *
 * Tous les services wrappent useApi (src/hooks/use-api.ts) et heritent
 * automatiquement de :
 * - Gestion du loading global (GlobalLoadingBar + LoadingOverlay)
 * - Toast d'erreur automatique
 * - Toast de succes optionnel (via successMessage)
 * - Parsing JSON uniforme
 *
 * Usage dans un composant "use client" :
 *   import { useVagueService } from "@/services";
 *   const vagueService = useVagueService();
 *   const { data, ok } = await vagueService.create(dto);
 *
 * Voir docs/decisions/018-service-layer-api-calls.md pour l'ADR complet.
 */

// -- Domaine piscicole --
export { useVagueService } from "./vague.service";
export { useReleveService } from "./releve.service";
export { useBacService } from "./bac.service";
export { useCalibrageService } from "./calibrage.service";
export { useAlevinsService } from "./alevins.service";

// -- Stock & Approvisionnement --
export { useStockService } from "./stock.service";
export { useDepenseService } from "./depense.service";

// -- Ventes & Finances --
export { useVenteService } from "./vente.service";
export { useFinanceService } from "./finance.service";

// -- Activites & Notifications --
export { useActiviteService } from "./activite.service";
export { useNotificationService } from "./notification.service";

// -- Analytics & Export --
export { useExportService } from "./export.service";
export { useAnalyticsService } from "./analytics.service";

// -- Auth & Utilisateurs --
export { useAuthService } from "./auth.service";
export { useUserService } from "./user.service";

// -- Configuration --
export { useConfigService } from "./config.service";

// -- Ingenieur & Notes --
export { useNoteService } from "./note.service";

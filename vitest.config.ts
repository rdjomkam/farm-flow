import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules/**", "src/__tests__/e2e/**"],
    // ADR-052 §3.1 — garde global : échoue bruyamment si process.env.CI est
    // défini sans DATABASE_URL, avant toute collecte de test.
    setupFiles: ["./src/test/ci-db-guard.setup.ts"],
    // Marge de sécurité complémentaire, PAS le correctif principal (voir
    // src/components/previsions/__tests__/test-utils.ts pour le vrai
    // correctif : suppression du coût artificiel de la frappe caractère
    // par caractère dans les tests de dialogues).
    //
    // Mesuré : sur cette machine (12 coeurs), les tests de composants les
    // plus lourds (rendu Radix + jsdom + grands tableaux) restent sous
    // ~1,3s en isolation mais peuvent dépasser le défaut de 5000ms sous la
    // contention CPU de la suite complète (~270 fichiers jsdom en
    // parallèle) — sans qu'aucune assertion n'échoue, uniquement par
    // `Test timed out`. 15000ms laisse une marge large (>10x le temps
    // isolé le plus élevé observé) sans masquer un test réellement bloqué :
    // un vrai deadlock échoue toujours, seulement 15s plus tard.
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

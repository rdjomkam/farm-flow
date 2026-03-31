/**
 * async-retry.ts — Helper de retry pour les operations async fire-and-forget.
 *
 * Fournit retryAsync() : execute une fonction async jusqu'a maxRetries fois,
 * avec un delai exponentiel entre les tentatives. Les echecs definitifs sont
 * loggues avec un niveau ERROR.
 */

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  /** Identifiant contextuel pour les logs (ex: "[POST /api/releves] hook SEUIL") */
  context?: string;
}

/**
 * Execute fn avec retry automatique sur echec.
 *
 * @param fn          Fonction async a executer.
 * @param options.maxRetries  Nombre maximum de tentatives supplementaires (defaut : 3).
 * @param options.delayMs     Delai de base en ms entre les tentatives (defaut : 1000).
 *                            Chaque tentative double le delai (backoff exponentiel).
 * @param options.context     Texte de contexte affiche dans les logs.
 *
 * @returns Promise<void> — ne rejette jamais, les erreurs sont loggees.
 */
export async function retryAsync(
  fn: () => Promise<void>,
  options: RetryOptions = {}
): Promise<void> {
  const { maxRetries = 3, delayMs = 1000, context = "retryAsync" } = options;

  const totalAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      const isLastAttempt = attempt === totalAttempts;

      if (isLastAttempt) {
        // Echec definitif apres tous les retries
        console.error(
          `[ERROR] ${context} — echec definitif apres ${maxRetries} retries :`,
          err
        );
      } else {
        // Echec transitoire : log warning + attente avant retry
        const wait = delayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[WARN] ${context} — tentative ${attempt}/${totalAttempts} echouee, retry dans ${wait}ms :`,
          err instanceof Error ? err.message : String(err)
        );
        await sleep(wait);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

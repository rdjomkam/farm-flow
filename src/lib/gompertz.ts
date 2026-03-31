/**
 * gompertz.ts
 *
 * Pure functions for Gompertz growth model calculations applied to
 * Clarias gariepinus (catfish) biometric data.
 *
 * Model: W(t) = W∞ × exp(−exp(−K × (t − ti)))
 *
 *   W∞  = asymptotic weight (g) — maximum weight the fish can physically reach
 *   K   = growth rate constant (day⁻¹) — curvature of the sigmoid
 *   ti  = inflection point (days) — day of maximum daily weight gain
 *
 * The Levenberg-Marquardt solver is implemented from scratch to avoid
 * ESM/CJS issues with the mljs npm package (see ADR-gompertz-lm-validation.md).
 *
 * Reference: scripts/test-gompertz-lm.ts — validated GO on 2026-03-29.
 */

// ─── Public interfaces ────────────────────────────────────────────────────────

/** Gompertz growth model parameters. */
export interface GompertzParams {
  /** Asymptotic weight W∞ (g) — maximum weight the fish can physically reach. */
  wInfinity: number;
  /** Growth rate constant K (day⁻¹) — curvature of the sigmoid. */
  k: number;
  /** Inflection point ti (days) — day of maximum daily weight gain. */
  ti: number;
}

/** Input for Gompertz calibration — a series of biometric measurements. */
export interface GompertzCalibrationInput {
  /** Observed data points: day index since stocking and mean weight (g). */
  points: Array<{ jour: number; poidsMoyen: number }>;
  /**
   * Optional initial parameter guess — values from ConfigElevage to seed the solver.
   * Each value is validated against physical bounds before use; out-of-bounds values
   * fall back to the heuristic.
   */
  initialGuess?: Partial<GompertzParams>;
}

/**
 * Biological defaults for Clarias gariepinus — pond culture, Cameroon.
 * Source: ADR-gompertz-lm-validation.md + FAO literature.
 */
export const CLARIAS_DEFAULTS = {
  wInfinity: 1200,  // g — asymptote littérature Clarias pond culture
  k: 0.018,         // day⁻¹ — constante croissance standard Cameroun
  ti: 95,           // jours — inflexion pour bacs béton Cameroun
} as const satisfies GompertzParams;

/** Confidence level labels for the calibration result. */
export type GompertzConfidenceLevel =
  | "INSUFFICIENT_DATA"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

/** Result of a successful Gompertz calibration. */
export interface GompertzCalibrationResult {
  /** Fitted Gompertz parameters. */
  params: GompertzParams;
  /** Coefficient of determination R² ∈ [0, 1]. */
  r2: number;
  /** Root mean squared error in grams. */
  rmse: number;
  /** Qualitative confidence level based on point count and R². */
  confidenceLevel: GompertzConfidenceLevel;
  /** Number of biometric points used for calibration. */
  biometrieCount: number;
}

// ─── Gompertz model evaluation ────────────────────────────────────────────────

/**
 * Evaluates the Gompertz growth function at time t.
 *
 * W(t) = W∞ × exp(−exp(−K × (t − ti)))
 *
 * @param t      - age in days since stocking
 * @param params - Gompertz parameters { wInfinity, k, ti }
 * @returns predicted weight in grams
 */
export function gompertzWeight(t: number, params: GompertzParams): number {
  const { wInfinity, k, ti } = params;
  return wInfinity * Math.exp(-Math.exp(-k * (t - ti)));
}

/**
 * Instantaneous growth rate dW/dt at time t.
 *
 * dW/dt = W∞ × K × exp(u) × exp(−exp(u))
 * where u = −K × (t − ti)
 *
 * @param t      - age in days since stocking
 * @param params - Gompertz parameters { wInfinity, k, ti }
 * @returns instantaneous growth rate in g/day
 */
export function gompertzVelocity(t: number, params: GompertzParams): number {
  const { wInfinity, k, ti } = params;
  const u = -k * (t - ti);
  const expU = Math.exp(u);
  return wInfinity * k * expU * Math.exp(-expU);
}

// ─── Linear algebra utilities (internal) ─────────────────────────────────────

type Matrix = number[][];
type Vector = number[];

/** Matrix-vector multiply: A × v */
function matVec(A: Matrix, v: Vector): Vector {
  return A.map((row) => row.reduce((sum, aij, j) => sum + aij * v[j], 0));
}

/** Transpose of matrix A */
function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const result: Matrix = Array.from({ length: cols }, () =>
    new Array(rows).fill(0)
  );
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

/** Matrix multiply: A × B */
function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const result: Matrix = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let kk = 0; kk < p; kk++) {
        result[i][j] += A[i][kk] * B[kk][j];
      }
    }
  }
  return result;
}

/**
 * Solve a 3×3 linear system A·x = b using Gaussian elimination with partial
 * pivoting. Returns null if the system is singular (det ≈ 0).
 */
function solve3x3(A: Matrix, b: Vector): Vector | null {
  const n = 3;
  // Augmented matrix [A | b] — deep copy
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find max element in this column
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    if (Math.abs(M[col][col]) < 1e-12) return null; // singular

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x: Vector = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }
  return x;
}

// ─── LM internals (internal) ─────────────────────────────────────────────────

/**
 * Partial derivatives of W(t) with respect to each parameter.
 * Required to build the Jacobian matrix for Levenberg-Marquardt.
 *
 * Let u = −K × (t − ti), then W = W∞ × exp(−exp(u))
 *
 * dW/dW∞ = exp(−exp(u))
 * dW/dK  = W∞ × exp(−exp(u)) × exp(u) × (t − ti)
 * dW/dti = W∞ × exp(−exp(u)) × exp(u) × (−K)
 */
function gompertzGradient(
  t: number,
  wInf: number,
  k: number,
  ti: number
): [number, number, number] {
  const u = -k * (t - ti);
  const expU = Math.exp(u);
  const expNegExpU = Math.exp(-expU);

  const dWdWinf = expNegExpU;
  const dWdK = wInf * expNegExpU * expU * (t - ti);
  const dWdTi = wInf * expNegExpU * expU * (-k);

  return [dWdWinf, dWdK, dWdTi];
}

/** Clamp each parameter to its physical bounds. */
function clampParams(
  params: [number, number, number],
  bounds: [[number, number], [number, number], [number, number]]
): [number, number, number] {
  return [
    Math.max(bounds[0][0], Math.min(bounds[0][1], params[0])),
    Math.max(bounds[1][0], Math.min(bounds[1][1], params[1])),
    Math.max(bounds[2][0], Math.min(bounds[2][1], params[2])),
  ];
}

/** Compute sum of squared residuals for a given parameter set. */
function computeSSR(
  data: { t: number; w: number }[],
  wInf: number,
  k: number,
  ti: number
): number {
  return data.reduce((sum, d) => {
    const u = -k * (d.t - ti);
    const predicted = wInf * Math.exp(-Math.exp(u));
    const residual = d.w - predicted;
    return sum + residual * residual;
  }, 0);
}

/**
 * Levenberg-Marquardt algorithm for Gompertz parameter estimation.
 *
 * Algorithm: Moré (1977) "The Levenberg-Marquardt algorithm: Implementation
 * and theory." Lecture Notes in Mathematics 630.
 *
 * @param data    - observed data points {t: day, w: weight_g}
 * @param initial - initial parameter guess [wInf, k, ti]
 * @param bounds  - physical bounds for each parameter
 * @returns fitted parameters [wInf, k, ti], R², RMSE
 */
function levenbergMarquardt(
  data: { t: number; w: number }[],
  initial: [number, number, number],
  bounds: [[number, number], [number, number], [number, number]]
): { params: [number, number, number]; r2: number; rmse: number } {
  const maxIter = 200;
  const tol = 1e-8;
  const lambdaUp = 10;
  const lambdaDown = 0.1;

  let [wInf, k, ti] = clampParams(initial, bounds);
  let lambda = 1e-3;

  const n = data.length;

  let ssr = computeSSR(data, wInf, k, ti);

  for (let iter = 0; iter < maxIter; iter++) {
    // Build Jacobian J (n×3) and residual vector r (n)
    const J: Matrix = [];
    const r: Vector = [];

    for (const d of data) {
      const u = -k * (d.t - ti);
      const predicted = wInf * Math.exp(-Math.exp(u));
      r.push(d.w - predicted);
      J.push(gompertzGradient(d.t, wInf, k, ti));
    }

    // Compute JᵀJ (3×3) and Jᵀr (3-vector)
    const Jt = transpose(J);
    const JtJ = matMul(Jt, J);
    const JtR = matVec(Jt, r);

    // Augmented normal equations: (JᵀJ + λ × diag(JᵀJ)) × δ = Jᵀr
    // Marquardt's diagonal scaling for better numerical conditioning
    const A: Matrix = JtJ.map((row, i) =>
      row.map((val, j) =>
        i === j ? val + lambda * Math.max(JtJ[i][i], 1e-10) : val
      )
    );

    const delta = solve3x3(A, JtR);
    if (delta === null) {
      lambda *= lambdaUp;
      continue;
    }

    // Proposed new parameters (clamped to physical bounds)
    const newParams = clampParams(
      [wInf + delta[0], k + delta[1], ti + delta[2]],
      bounds
    );

    const newSsr = computeSSR(data, newParams[0], newParams[1], newParams[2]);

    if (newSsr < ssr) {
      // Accept step
      [wInf, k, ti] = newParams;
      ssr = newSsr;
      lambda *= lambdaDown;
      lambda = Math.max(lambda, 1e-15); // prevent underflow

      // Check convergence: step norm
      const stepNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
      if (stepNorm < tol) {
        break;
      }
    } else {
      // Reject step — increase damping
      lambda *= lambdaUp;
      if (lambda > 1e15) {
        break; // lambda diverged
      }
    }
  }

  // Final statistics
  const wMean = data.reduce((s, d) => s + d.w, 0) / n;
  const sst = data.reduce((s, d) => s + (d.w - wMean) ** 2, 0);
  const r2 = sst > 0 ? Math.max(0, 1 - ssr / sst) : 0;
  const rmse = Math.sqrt(ssr / n);

  return { params: [wInf, k, ti], r2, rmse };
}

// ─── Initialization & bounds (internal) ──────────────────────────────────────

/**
 * Heuristic initial parameter guess using biological defaults for Clarias.
 *
 * W∞₀ = max(2.5 × maxObserved, CLARIAS_DEFAULTS.wInfinity)  — always ≥ 1200g
 * K₀  = CLARIAS_DEFAULTS.k (0.018)
 * ti₀ = CLARIAS_DEFAULTS.ti (95)
 *
 * If initialGuess.* is provided and within bounds, it takes precedence.
 *
 * @param data           - observed data points {t, w}
 * @param initialGuess   - optional caller-supplied starting values (from ConfigElevage)
 */
function buildInitialGuess(
  data: { t: number; w: number }[],
  initialGuess?: Partial<GompertzParams>
): [number, number, number] {
  const maxW = Math.max(...data.map((d) => d.w));

  // W∞: biological floor ensures the asymptote is never too low
  const wInfHeuristic = Math.max(maxW * 2.5, CLARIAS_DEFAULTS.wInfinity);
  const wInf =
    initialGuess?.wInfinity !== undefined &&
    initialGuess.wInfinity >= CLARIAS_DEFAULTS.wInfinity &&
    initialGuess.wInfinity <= 3000
      ? initialGuess.wInfinity
      : Math.min(wInfHeuristic, 3000);

  // K: must be within [0.005, 0.2] day⁻¹
  const k =
    initialGuess?.k !== undefined &&
    initialGuess.k >= 0.005 &&
    initialGuess.k <= 0.2
      ? initialGuess.k
      : CLARIAS_DEFAULTS.k;

  // ti: must be within [0, 300] days
  const ti =
    initialGuess?.ti !== undefined &&
    initialGuess.ti >= 0 &&
    initialGuess.ti <= 300
      ? initialGuess.ti
      : CLARIAS_DEFAULTS.ti;

  return [wInf, k, ti];
}

/**
 * Physical bounds for Gompertz parameters — Clarias gariepinus pond culture.
 *
 * W∞  ∈ [max(maxObserved, CLARIAS_DEFAULTS.wInfinity), 3000] g — biological floor for the species
 * K   ∈ [0.005, 0.2]  day⁻¹
 * ti  ∈ [0, 300]       days
 */
function buildBounds(
  data: { t: number; w: number }[],
  initialGuess?: Partial<GompertzParams>
): [[number, number], [number, number], [number, number]] {
  const maxObserved = Math.max(...data.map((d) => d.w));
  const wInfFloor =
    initialGuess?.wInfinity !== undefined &&
    initialGuess.wInfinity >= CLARIAS_DEFAULTS.wInfinity &&
    initialGuess.wInfinity <= 3000
      ? initialGuess.wInfinity
      : CLARIAS_DEFAULTS.wInfinity;
  return [
    [Math.max(maxObserved, wInfFloor), 3000],
    [0.005, 0.2],
    [0, 300],
  ];
}

// ─── Confidence level (internal) ─────────────────────────────────────────────

/**
 * Determine qualitative confidence level from point count and R².
 *
 * Thresholds are relative to `minPoints` (default 5):
 *   INSUFFICIENT_DATA : n < minPoints
 *   LOW               : minPoints ≤ n ≤ minPoints + 1
 *   MEDIUM            : minPoints + 2 ≤ n ≤ minPoints + 4
 *   HIGH              : n ≥ minPoints + 5 AND R² > 0.95
 */
function resolveConfidenceLevel(
  n: number,
  r2: number,
  minPoints: number = 5
): GompertzConfidenceLevel {
  if (n < minPoints) return "INSUFFICIENT_DATA";
  if (n <= minPoints + 1) return "LOW";
  if (n <= minPoints + 4) return "MEDIUM";
  // n >= minPoints + 5
  return r2 > 0.95 ? "HIGH" : "MEDIUM";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calibrate Gompertz parameters from biometric measurements using
 * Levenberg-Marquardt non-linear least squares.
 *
 * Returns null when fewer than `minPoints` data points are provided — the
 * system is under-determined and the fitted parameters are not reliable.
 *
 * @param input     - array of {jour, poidsMoyen} biometric observations
 * @param minPoints - minimum number of points required (default 5)
 * @returns calibration result or null if insufficient points
 */
export function calibrerGompertz(
  input: GompertzCalibrationInput,
  minPoints: number = 5
): GompertzCalibrationResult | null {
  const { points, initialGuess } = input;

  if (points.length < minPoints) {
    return null;
  }

  // Convert to internal format
  const data = points.map((p) => ({ t: p.jour, w: p.poidsMoyen }));

  const initial = buildInitialGuess(data, initialGuess);
  const bounds = buildBounds(data, initialGuess);

  const { params, r2, rmse } = levenbergMarquardt(data, initial, bounds);

  const [wInfinity, k, ti] = params;
  const confidenceLevel = resolveConfidenceLevel(points.length, r2, minPoints);

  return {
    params: { wInfinity, k, ti },
    r2,
    rmse,
    confidenceLevel,
    biometrieCount: points.length,
  };
}

/**
 * Numerically inverts the Gompertz function to find the day t at which
 * W(t) = targetWeight, using the bisection method.
 *
 * This is used as a fallback when the target weight is in the asymptotic zone
 * (≥ 95% of W∞), where the analytic formula ln(−ln(ratio))/K becomes
 * numerically unreliable because ln(−ln(ratio)) → −∞ as ratio → 1.
 *
 * The bisection method is guaranteed to converge for any monotone function.
 * It searches in the interval [currentDay, currentDay + maxDays] for the
 * crossing point where W(t) = targetWeight, to within the specified tolerance.
 *
 * @param params       - calibrated Gompertz parameters { wInfinity, k, ti }
 * @param targetWeight - target weight in grams (must be < wInfinity)
 * @param currentDay   - current age of the batch in days (search lower bound)
 * @param tolerance    - convergence tolerance in days (default 0.1, well within ±0.5 day)
 * @param maxDays      - maximum day offset to search beyond currentDay (default 3000)
 * @returns the day t at which W(t) = targetWeight, or null if not found in range
 */
export function numericallyInvertGompertz(
  params: GompertzParams,
  targetWeight: number,
  currentDay: number,
  tolerance: number = 0.1,
  maxDays: number = 3000
): number | null {
  const lo = currentDay;
  const hi = currentDay + maxDays;

  const wLo = gompertzWeight(lo, params);
  const wHi = gompertzWeight(hi, params);

  // If target is already below current weight, the solution is at or before lo
  if (wLo >= targetWeight) return lo;

  // If target exceeds what we can reach even at hi, it's unreachable in range
  if (wHi < targetWeight) return null;

  // Bisection: W is monotone increasing, so W(mid) - target changes sign
  let left = lo;
  let right = hi;

  for (let iter = 0; iter < 100; iter++) {
    const mid = (left + right) / 2;
    if (right - left < tolerance) {
      return mid;
    }
    const wMid = gompertzWeight(mid, params);
    if (wMid < targetWeight) {
      left = mid;
    } else {
      right = mid;
    }
  }

  return (left + right) / 2;
}

/**
 * Project the number of days remaining to reach a target weight.
 *
 * For targets below 95% of W∞, uses the analytic inversion:
 *   t* = ti − ln(−ln(poidsObjectif / W∞)) / K
 *
 * For targets in the asymptotic zone (≥ 95% of W∞ and < W∞), the analytic
 * formula becomes numerically unreliable (ln(−ln(ratio)) → −∞ as ratio → 1),
 * so the function falls back to bisection via `numericallyInvertGompertz()`.
 * This ensures valid projections for large harvest targets close to the
 * asymptote (e.g., 96%, 98%, 99.5% of W∞), which were previously rejected.
 *
 * Returns null only when W∞ ≤ poidsObjectif (target is physically unreachable).
 *
 * @param params         - calibrated Gompertz parameters
 * @param poidsObjectif  - harvest target weight in grams
 * @param joursActuels   - current age of the batch in days
 * @returns days remaining (≥ 0), or null if target is unreachable
 */
export function projeterDateRecolte(
  params: GompertzParams,
  poidsObjectif: number,
  joursActuels: number
): number | null {
  const { wInfinity, k, ti } = params;

  if (wInfinity <= poidsObjectif) {
    // Target weight exceeds the asymptotic weight — unreachable
    return null;
  }

  let tStar: number;

  if (poidsObjectif >= 0.95 * wInfinity) {
    // Asymptotic zone (≥ 95% of W∞): analytic inversion is numerically
    // unreliable here. Use bisection fallback with ±0.1 day precision.
    const result = numericallyInvertGompertz(params, poidsObjectif, joursActuels);
    if (result === null) return null;
    return Math.max(0, result - joursActuels);
  }

  // Analytic inversion: t* = ti - ln(-ln(W_obj / W∞)) / K
  const ratio = poidsObjectif / wInfinity;
  // ratio ∈ (0, 1) because wInfinity > poidsObjectif > 0
  tStar = ti - Math.log(-Math.log(ratio)) / k;

  const joursRestants = tStar - joursActuels;

  // If already past the projected date, return 0 (target already reached or
  // model predicts it was reached in the past)
  return Math.max(0, joursRestants);
}

/**
 * Generate a series of (jour, poids) points for charting the Gompertz curve.
 *
 * @param params  - Gompertz parameters
 * @param joursMax - maximum day index to generate (inclusive)
 * @param pas      - step in days between generated points
 * @returns array of { jour, poids } points
 */
export function genererCourbeGompertz(
  params: GompertzParams,
  joursMax: number,
  pas: number
): Array<{ jour: number; poids: number }> {
  const result: Array<{ jour: number; poids: number }> = [];
  for (let jour = 0; jour <= joursMax; jour += pas) {
    result.push({ jour, poids: gompertzWeight(jour, params) });
  }
  // Always include the last point if joursMax is not a multiple of pas
  const lastJour = result[result.length - 1]?.jour;
  if (lastJour !== undefined && lastJour < joursMax) {
    result.push({ jour: joursMax, poids: gompertzWeight(joursMax, params) });
  }
  return result;
}

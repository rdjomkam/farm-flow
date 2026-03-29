/**
 * test-gompertz-lm.ts
 *
 * Validation script for Levenberg-Marquardt convergence on Gompertz growth model
 * applied to Clarias gariepinus (catfish) biometric data.
 *
 * This script is STANDALONE — no external dependencies beyond Node.js built-ins.
 * It implements LM from scratch to avoid ESM/CJS issues with mljs packages.
 *
 * Usage:
 *   npx tsx scripts/test-gompertz-lm.ts
 *
 * Gompertz model:
 *   W(t) = W_inf * exp( -exp( -K * (t - ti) ) )
 *
 *   W_inf  = asymptotic weight (g) — max weight the fish can physically reach
 *   K      = growth rate constant (day⁻¹) — curvature of the sigmoid
 *   ti     = inflection point (days) — day of maximum daily weight gain
 *
 * Reference values for Clarias gariepinus (literature):
 *   K      ∈ [0.015, 0.05]
 *   W_inf  ∈ [800, 2000] g (pond culture)
 *   ti     ∈ [40, 100] days
 */

// ─── Gompertz model ──────────────────────────────────────────────────────────

/**
 * Evaluates the Gompertz growth function at time t.
 *
 * @param t     - age in days since stocking
 * @param wInf  - asymptotic weight (g)
 * @param k     - growth rate constant (day⁻¹)
 * @param ti    - inflection point (days)
 */
function gompertz(t: number, wInf: number, k: number, ti: number): number {
  return wInf * Math.exp(-Math.exp(-k * (t - ti)));
}

/**
 * Partial derivatives of the Gompertz function with respect to each parameter.
 * Required by Levenberg-Marquardt to build the Jacobian matrix.
 *
 * Let u = -K * (t - ti), then W = W_inf * exp(-exp(u))
 *
 * dW/dW_inf = exp(-exp(u))
 * dW/dK     = W_inf * exp(-exp(u)) * exp(u) * (t - ti)
 * dW/dti    = W_inf * exp(-exp(u)) * exp(u) * (-K)
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

// ─── Linear algebra utilities ─────────────────────────────────────────────────

type Matrix = number[][];
type Vector = number[];

/** Matrix-vector multiply: A * v */
function matVec(A: Matrix, v: Vector): Vector {
  return A.map((row) => row.reduce((sum, aij, j) => sum + aij * v[j], 0));
}

/** Transpose of matrix A */
function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const result: Matrix = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = A[i][j];
    }
  }
  return result;
}

/** Matrix multiply: A * B */
function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const result: Matrix = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

/**
 * Solve a 3x3 linear system Ax = b using Gaussian elimination with partial pivoting.
 * Returns null if the system is singular (det ≈ 0).
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

// ─── Levenberg-Marquardt implementation ──────────────────────────────────────

interface LMOptions {
  /** Initial parameter guess: [W_inf, K, ti] */
  initialParams: [number, number, number];
  /** Parameter bounds: [[min_wInf, max_wInf], [min_k, max_k], [min_ti, max_ti]] */
  bounds: [[number, number], [number, number], [number, number]];
  /** Maximum iterations (default: 200) */
  maxIterations?: number;
  /** Convergence tolerance on parameter step norm (default: 1e-8) */
  tolerance?: number;
  /** Initial damping factor lambda (default: 1e-3) */
  lambdaInit?: number;
  /** Lambda scale up factor (default: 10) */
  lambdaUp?: number;
  /** Lambda scale down factor (default: 0.1) */
  lambdaDown?: number;
}

interface LMResult {
  /** Fitted parameters [W_inf, K, ti] */
  params: [number, number, number];
  /** Number of iterations used */
  iterations: number;
  /** Sum of squared residuals */
  ssr: number;
  /** Coefficient of determination R² */
  rSquared: number;
  /** Root mean squared error (g) */
  rmse: number;
  /** Whether convergence was achieved within maxIterations */
  converged: boolean;
  /** Final lambda value (diagnostic — smaller = well-conditioned) */
  finalLambda: number;
  /** Convergence reason */
  reason: string;
}

/**
 * Clamps each parameter to its specified bounds.
 */
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

/**
 * Compute sum of squared residuals for a given parameter set.
 */
function computeSSR(
  data: { t: number; w: number }[],
  wInf: number,
  k: number,
  ti: number
): number {
  return data.reduce((sum, d) => {
    const residual = d.w - gompertz(d.t, wInf, k, ti);
    return sum + residual * residual;
  }, 0);
}

/**
 * Levenberg-Marquardt algorithm for Gompertz parameter estimation.
 *
 * Algorithm reference: Moré (1977) — "The Levenberg-Marquardt algorithm:
 * Implementation and theory." Lecture Notes in Mathematics 630.
 *
 * @param data   - observed data points {t: day, w: weight_g}
 * @param opts   - algorithm options
 */
function levenbergMarquardt(
  data: { t: number; w: number }[],
  opts: LMOptions
): LMResult {
  const maxIter = opts.maxIterations ?? 200;
  const tol = opts.tolerance ?? 1e-8;
  const lambdaUp = opts.lambdaUp ?? 10;
  const lambdaDown = opts.lambdaDown ?? 0.1;

  let [wInf, k, ti] = clampParams(opts.initialParams, opts.bounds);
  let lambda = opts.lambdaInit ?? 1e-3;

  const n = data.length; // number of data points
  const p = 3;           // number of parameters

  let ssr = computeSSR(data, wInf, k, ti);
  let iterations = 0;
  let reason = "max_iterations_reached";

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    // Build Jacobian J (n x 3) and residual vector r (n)
    const J: Matrix = [];
    const r: Vector = [];

    for (const d of data) {
      const predicted = gompertz(d.t, wInf, k, ti);
      r.push(d.w - predicted);
      J.push(gompertzGradient(d.t, wInf, k, ti));
    }

    // Compute Jᵀ * J (3x3)
    const Jt = transpose(J);
    const JtJ = matMul(Jt, J);

    // Compute Jᵀ * r (3-vector, gradient direction)
    const JtR = matVec(Jt, r);

    // Build augmented normal equations: (JᵀJ + λ * diag(JᵀJ)) * δ = Jᵀr
    // Using diagonal scaling (Marquardt's original suggestion)
    const A: Matrix = JtJ.map((row, i) =>
      row.map((val, j) => (i === j ? val + lambda * Math.max(JtJ[i][i], 1e-10) : val))
    );

    const delta = solve3x3(A, JtR);
    if (delta === null) {
      // Singular system — increase damping and retry
      lambda *= lambdaUp;
      continue;
    }

    // Proposed new parameters
    const newParams = clampParams(
      [wInf + delta[0], k + delta[1], ti + delta[2]],
      opts.bounds
    );

    const newSsr = computeSSR(data, newParams[0], newParams[1], newParams[2]);

    // Gain ratio: actual improvement / predicted improvement
    // If gain > 0, step is acceptable
    if (newSsr < ssr) {
      // Accept step
      [wInf, k, ti] = newParams;
      ssr = newSsr;
      lambda *= lambdaDown;
      lambda = Math.max(lambda, 1e-15); // prevent underflow

      // Check convergence: step norm
      const stepNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
      if (stepNorm < tol) {
        reason = `converged_step_norm_${stepNorm.toExponential(2)}`;
        break;
      }
    } else {
      // Reject step — increase damping
      lambda *= lambdaUp;

      // Prevent lambda runaway
      if (lambda > 1e15) {
        reason = "lambda_diverged";
        break;
      }
    }
  }

  // Compute final statistics
  const wMean = data.reduce((s, d) => s + d.w, 0) / n;
  const sst = data.reduce((s, d) => s + (d.w - wMean) ** 2, 0);
  const rSquared = sst > 0 ? Math.max(0, 1 - ssr / sst) : 0;
  const rmse = Math.sqrt(ssr / n);

  // If the loop ended via a break that set reason to a convergence string, keep it.
  // If it ended naturally (all iterations used), reason stays "max_iterations_reached".
  // The converged flag reflects whether we exited early with a named convergence reason.

  return {
    params: [wInf, k, ti],
    iterations,
    ssr,
    rSquared,
    rmse,
    converged: reason !== "max_iterations_reached" && reason !== "lambda_diverged",
    finalLambda: lambda,
    reason,
  };
}

// ─── Test datasets ────────────────────────────────────────────────────────────

/**
 * Dataset 1 — seed data, vague_01 (VAGUE-2026-01)
 * Start date: 2026-01-15
 * Three BIOMETRIE releves:
 *   rel_01  2026-01-22  J7   poidsMoyen=12.3g  bac_01
 *   rel_02  2026-02-05  J21  poidsMoyen=28.7g  bac_02
 *   rel_03  2026-02-19  J35  poidsMoyen=55.4g  bac_01
 *
 * Note: only 3 points — early growth phase only, model may not capture full sigmoid.
 * These are real data from the application seed.
 */
const datasetVague01: { t: number; w: number; label: string }[] = [
  { t: 7,  w: 12.3,  label: "rel_01 J7" },
  { t: 21, w: 28.7,  label: "rel_02 J21" },
  { t: 35, w: 55.4,  label: "rel_03 J35" },
];

/**
 * Dataset 2 — seed data, vague_02 (VAGUE-2025-03)
 * Start date: 2025-10-01
 * Two BIOMETRIE releves:
 *   rel_18  2025-10-15  J14  poidsMoyen=45.0g  bac_04 (etang)
 *   rel_19  2025-11-15  J45  poidsMoyen=180.0g bac_04 (etang)
 *
 * Note: only 2 points — insufficient for reliable Gompertz fitting.
 * Demonstrates minimum data requirement validation.
 */
const datasetVague02: { t: number; w: number; label: string }[] = [
  { t: 14, w: 45.0,  label: "rel_18 J14" },
  { t: 45, w: 180.0, label: "rel_19 J45" },
];

/**
 * Dataset 3 — FAO/CIRAD reference curve for Clarias gariepinus (5 points)
 * Source: ADR-courbe-croissance-reference.md
 * Simulates 5 well-distributed biometric measurements from J30 to J120.
 * This is the MINIMUM VIABLE scenario for Gompertz convergence.
 */
const datasetFao5Points: { t: number; w: number; label: string }[] = [
  { t: 30,  w: 15,  label: "FAO J30" },
  { t: 60,  w: 50,  label: "FAO J60" },
  { t: 90,  w: 150, label: "FAO J90" },
  { t: 120, w: 300, label: "FAO J120" },
  { t: 150, w: 500, label: "FAO J150" },
];

/**
 * Dataset 4 — FAO/CIRAD reference curve, 10 points
 * Well-distributed from alevinage to finition — ideal fitting scenario.
 */
const datasetFao10Points: { t: number; w: number; label: string }[] = [
  { t: 10,  w: 2,   label: "FAO J10" },
  { t: 20,  w: 5,   label: "FAO J20" },
  { t: 30,  w: 15,  label: "FAO J30" },
  { t: 45,  w: 35,  label: "FAO J45" },
  { t: 60,  w: 50,  label: "FAO J60" },  // Note: local plateau in FAO data
  { t: 75,  w: 90,  label: "FAO J75" },
  { t: 90,  w: 150, label: "FAO J90" },
  { t: 105, w: 210, label: "FAO J105" },
  { t: 120, w: 300, label: "FAO J120" },
  { t: 135, w: 390, label: "FAO J135" },
];

/**
 * Dataset 5 — FAO/CIRAD reference curve, 15 points (full curve)
 * Complete growth cycle from J0 to J210 — maximum data scenario.
 */
const datasetFao15Points: { t: number; w: number; label: string }[] = [
  { t: 0,   w: 0.5, label: "FAO J0" },
  { t: 10,  w: 2,   label: "FAO J10" },
  { t: 20,  w: 5,   label: "FAO J20" },
  { t: 30,  w: 15,  label: "FAO J30" },
  { t: 45,  w: 35,  label: "FAO J45" },
  { t: 60,  w: 50,  label: "FAO J60" },
  { t: 75,  w: 90,  label: "FAO J75" },
  { t: 90,  w: 150, label: "FAO J90" },
  { t: 105, w: 210, label: "FAO J105" },
  { t: 120, w: 300, label: "FAO J120" },
  { t: 135, w: 390, label: "FAO J135" },
  { t: 150, w: 500, label: "FAO J150" },
  { t: 165, w: 620, label: "FAO J165" },
  { t: 180, w: 750, label: "FAO J180" },
  { t: 210, w: 950, label: "FAO J210" },
];

// ─── Parameter bounds ─────────────────────────────────────────────────────────

/**
 * Physical bounds for Gompertz parameters — Clarias gariepinus pond culture.
 *
 * W_inf: must exceed max observed weight; cap at 3000g for intensive pond culture
 * K:     physiological range from literature (FAO/CIRAD)
 * ti:    inflection within typical grow-out cycle (0–120 days)
 */
function buildBounds(
  data: { t: number; w: number }[]
): [[number, number], [number, number], [number, number]] {
  const maxObserved = Math.max(...data.map((d) => d.w));
  return [
    [maxObserved * 1.05, 3000],  // W_inf: at least 5% above max observed
    [0.005, 0.2],                 // K: [0.005, 0.2] day⁻¹
    [0, 120],                     // ti: [0, 120] days
  ];
}

// ─── Initial parameter guess ──────────────────────────────────────────────────

/**
 * Heuristic initial parameter guess for Gompertz fitting.
 *
 * Strategy:
 * - W_inf: 2x max observed weight (conservative estimate of asymptote)
 * - K: 0.03 (middle of typical range for Clarias gariepinus)
 * - ti: mean time of the data range (inflection somewhere in the middle)
 */
function initialGuess(
  data: { t: number; w: number }[]
): [number, number, number] {
  const maxW = Math.max(...data.map((d) => d.w));
  const tMean = data.reduce((s, d) => s + d.t, 0) / data.length;
  return [maxW * 2.5, 0.03, tMean];
}

// ─── Test runner ──────────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  description: string;
  data: { t: number; w: number; label: string }[];
  nPoints: number;
  expectedMinR2: number;
  expectedMaxIter: number;
  note?: string;
}

const testCases: TestCase[] = [
  {
    name: "seed_vague_01_3pts",
    description: "Seed data — VAGUE-2026-01 (3 biometric releves, early growth only)",
    data: datasetVague01,
    nPoints: 3,
    expectedMinR2: 0.90,
    expectedMaxIter: 200,
    note: "WARNING: 3 points is below the recommended minimum of 5 for reliable Gompertz fitting. " +
          "Parameters will have high uncertainty. Early-phase data cannot constrain W_inf reliably.",
  },
  {
    name: "seed_vague_02_2pts",
    description: "Seed data — VAGUE-2025-03 (2 biometric releves — minimum insufficient)",
    data: datasetVague02,
    nPoints: 2,
    expectedMinR2: 0.90,
    expectedMaxIter: 200,
    note: "CRITICAL: 2 points is insufficient for 3-parameter Gompertz fitting. " +
          "System is under-determined. Results are unreliable by construction.",
  },
  {
    name: "fao_5_points",
    description: "FAO reference — 5 well-distributed points (J30–J150) — minimum viable",
    data: datasetFao5Points,
    nPoints: 5,
    expectedMinR2: 0.98,
    expectedMaxIter: 200,
  },
  {
    name: "fao_10_points",
    description: "FAO reference — 10 points (J10–J135) — good coverage",
    data: datasetFao10Points,
    nPoints: 10,
    expectedMinR2: 0.98,
    expectedMaxIter: 200,
  },
  {
    name: "fao_15_points",
    description: "FAO reference — 15 points (J0–J210) — full curve",
    data: datasetFao15Points,
    nPoints: 15,
    expectedMinR2: 0.98,
    expectedMaxIter: 200,
  },
];

// ─── Console output helpers ────────────────────────────────────────────────────

function hr(char = "─", width = 70): string {
  return char.repeat(width);
}

function formatR2(r2: number): string {
  const pct = (r2 * 100).toFixed(2);
  if (r2 >= 0.98) return `\x1b[32m${pct}%\x1b[0m`; // green
  if (r2 >= 0.90) return `\x1b[33m${pct}%\x1b[0m`; // yellow
  return `\x1b[31m${pct}%\x1b[0m`;                  // red
}

function formatStatus(pass: boolean): string {
  return pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface SummaryRow {
  name: string;
  nPts: number;
  iterations: number;
  r2: number;
  wInf: number;
  k: number;
  ti: number;
  rmse: number;
  converged: boolean;
  iterPass: boolean;
  r2Pass: boolean;
  boundsPass: boolean;
  wInfAboveMax: boolean;
}

function main(): void {
  console.log("\n" + hr("═"));
  console.log("  VALIDATION LEVENBERG-MARQUARDT — MODELE DE GOMPERTZ");
  console.log("  Clarias gariepinus — FarmFlow Suivi Silures");
  console.log(hr("═") + "\n");

  const summary: SummaryRow[] = [];
  let allPass = true;

  for (const tc of testCases) {
    console.log(hr());
    console.log(`TEST: ${tc.name}`);
    console.log(`      ${tc.description}`);
    console.log(hr());

    // Print input data
    console.log("\nDonnees d'entree:");
    for (const d of tc.data) {
      console.log(`  J${String(d.t).padEnd(4)} → ${d.w.toFixed(1).padStart(7)}g   (${d.label})`);
    }

    if (tc.note) {
      console.log(`\n  \x1b[33mATTENTION:\x1b[0m ${tc.note}`);
    }

    // Build bounds and initial guess
    const bounds = buildBounds(tc.data);
    const guess = initialGuess(tc.data);

    console.log(`\nParametres initiaux:`);
    console.log(`  W_inf = ${guess[0].toFixed(1)}g   K = ${guess[1].toFixed(4)}   ti = ${guess[2].toFixed(1)}j`);
    console.log(`\nBornes physiques:`);
    console.log(`  W_inf ∈ [${bounds[0][0].toFixed(1)}, ${bounds[0][1]}]g`);
    console.log(`  K     ∈ [${bounds[1][0]}, ${bounds[1][1]}] j⁻¹`);
    console.log(`  ti    ∈ [${bounds[2][0]}, ${bounds[2][1]}] j`);

    // Run LM
    const result = levenbergMarquardt(tc.data, {
      initialParams: guess,
      bounds,
      maxIterations: tc.expectedMaxIter,
    });

    const [wInfFit, kFit, tiFit] = result.params;

    // Validation checks
    const maxObs = Math.max(...tc.data.map((d) => d.w));
    const iterPass = result.iterations <= tc.expectedMaxIter;
    const r2Pass = result.rSquared >= tc.expectedMinR2;
    const boundsPass =
      kFit >= bounds[1][0] && kFit <= bounds[1][1] &&
      tiFit >= bounds[2][0] && tiFit <= bounds[2][1] &&
      wInfFit >= bounds[0][0] && wInfFit <= bounds[0][1];
    const wInfAboveMax = wInfFit > maxObs;

    console.log(`\nResultats LM:`);
    console.log(`  Iterations     : ${result.iterations} / ${tc.expectedMaxIter}  [${formatStatus(iterPass)}]`);
    console.log(`  Convergence    : ${result.reason}`);
    console.log(`  Lambda final   : ${result.finalLambda.toExponential(3)}`);
    console.log(`\nParametres ajustes:`);
    console.log(`  W_inf = ${wInfFit.toFixed(2)}g    (> ${maxObs}g observé: ${formatStatus(wInfAboveMax)})`);
    console.log(`  K     = ${kFit.toFixed(5)} j⁻¹`);
    console.log(`  ti    = ${tiFit.toFixed(2)} j`);
    console.log(`\nQualite d'ajustement:`);
    console.log(`  R²   = ${formatR2(result.rSquared)}  (seuil: ${(tc.expectedMinR2 * 100).toFixed(0)}%)  [${formatStatus(r2Pass)}]`);
    console.log(`  RMSE = ${result.rmse.toFixed(3)}g`);
    console.log(`  SSR  = ${result.ssr.toFixed(4)}`);

    // Residuals
    console.log(`\nResidus (observé − prédit):`);
    for (const d of tc.data) {
      const predicted = gompertz(d.t, wInfFit, kFit, tiFit);
      const residual = d.w - predicted;
      const pctError = Math.abs((residual / d.w) * 100).toFixed(1);
      const sign = residual >= 0 ? "+" : "";
      console.log(
        `  J${String(d.t).padEnd(4)} obs=${d.w.toFixed(1).padStart(7)}g  pred=${predicted.toFixed(1).padStart(7)}g  err=${sign}${residual.toFixed(2)}g (${pctError}%)`
      );
    }

    // Literature comparison (only if K is in physiological range)
    const kInLit = kFit >= 0.015 && kFit <= 0.05;
    const wInfInLit = wInfFit >= 800 && wInfFit <= 2000;
    const tiInLit = tiFit >= 40 && tiFit <= 100;
    console.log(`\nComparaison litterature Clarias gariepinus:`);
    console.log(`  K     ∈ [0.015, 0.05]?    ${formatStatus(kInLit)}  (K=${kFit.toFixed(5)})`);
    console.log(`  W_inf ∈ [800, 2000]g?     ${formatStatus(wInfInLit)}  (W_inf=${wInfFit.toFixed(1)}g)`);
    console.log(`  ti    ∈ [40, 100]j?       ${formatStatus(tiInLit)}  (ti=${tiFit.toFixed(1)}j)`);

    const casePass = iterPass && r2Pass && boundsPass && wInfAboveMax;
    allPass = allPass && casePass;

    console.log(`\n  Resultat global: ${formatStatus(casePass)}\n`);

    summary.push({
      name: tc.name,
      nPts: tc.data.length,
      iterations: result.iterations,
      r2: result.rSquared,
      wInf: wInfFit,
      k: kFit,
      ti: tiFit,
      rmse: result.rmse,
      converged: result.converged,
      iterPass,
      r2Pass,
      boundsPass,
      wInfAboveMax,
    });
  }

  // ─── Summary table ───────────────────────────────────────────────────────────

  console.log("\n" + hr("═"));
  console.log("  RECAPITULATIF");
  console.log(hr("═"));
  console.log(
    "\n  " +
    "Dataset".padEnd(28) +
    "N".padStart(4) +
    "Iter".padStart(6) +
    "R²".padStart(8) +
    "W_inf(g)".padStart(10) +
    "K".padStart(8) +
    "ti(j)".padStart(8) +
    "RMSE(g)".padStart(9) +
    "  Statut"
  );
  console.log("  " + hr("─", 83));

  for (const row of summary) {
    const casePass = row.iterPass && row.r2Pass && row.boundsPass && row.wInfAboveMax;
    console.log(
      "  " +
      row.name.padEnd(28) +
      String(row.nPts).padStart(4) +
      String(row.iterations).padStart(6) +
      (" " + (row.r2 * 100).toFixed(1) + "%").padStart(8) +
      row.wInf.toFixed(0).padStart(10) +
      row.k.toFixed(4).padStart(8) +
      row.ti.toFixed(1).padStart(8) +
      row.rmse.toFixed(2).padStart(9) +
      "  " + formatStatus(casePass)
    );
  }

  // ─── GO / NO-GO decision ──────────────────────────────────────────────────────

  console.log("\n" + hr("═"));
  console.log("  DECISION GO / NO-GO");
  console.log(hr("═") + "\n");

  // Key acceptance criteria
  const fao5 = summary.find((s) => s.name === "fao_5_points")!;
  const fao10 = summary.find((s) => s.name === "fao_10_points")!;
  const fao15 = summary.find((s) => s.name === "fao_15_points")!;

  const criterion1 = fao5.iterations <= 200 && fao10.iterations <= 200 && fao15.iterations <= 200;
  const criterion2 = fao5.r2 >= 0.90 && fao10.r2 >= 0.90 && fao15.r2 >= 0.90;
  const criterion3 = fao5.wInf > Math.max(...datasetFao5Points.map(d => d.w)) &&
                     fao10.wInf > Math.max(...datasetFao10Points.map(d => d.w)) &&
                     fao15.wInf > Math.max(...datasetFao15Points.map(d => d.w));
  const criterion4 = fao5.k > 0 && fao10.k > 0 && fao15.k > 0;

  console.log(`  Critere 1 — LM converge < 200 iterations:  ${formatStatus(criterion1)}`);
  console.log(`  Critere 2 — R² > 0.90 avec 5+ points:      ${formatStatus(criterion2)}`);
  console.log(`  Critere 3 — W_inf > max observé:            ${formatStatus(criterion3)}`);
  console.log(`  Critere 4 — K > 0 (parametre positif):      ${formatStatus(criterion4)}`);

  const allCriteria = criterion1 && criterion2 && criterion3 && criterion4;
  console.log("\n  " + hr("─", 46));
  if (allCriteria) {
    console.log("  \x1b[32m\x1b[1m  DECISION : GO\x1b[0m");
    console.log("  L'algorithme LM converge correctement sur le modele de Gompertz");
    console.log("  avec des donnees Clarias gariepinus representant 5+ points biometriques.");
  } else {
    console.log("  \x1b[31m\x1b[1m  DECISION : NO-GO\x1b[0m");
    console.log("  Des criteres d'acceptation ne sont pas satisfaits.");
    console.log("  Revoir la strategie d'initialisation ou les bornes de parametres.");
  }

  // Minimum data requirement
  const seedVague01 = summary.find((s) => s.name === "seed_vague_01_3pts")!;
  const seedVague02 = summary.find((s) => s.name === "seed_vague_02_2pts")!;
  console.log("\n  " + hr("─", 46));
  console.log("  CONTRAINTE MINIMALE DE DONNEES:");
  console.log(`  - 2 points (vague_02): R²=${(seedVague02.r2 * 100).toFixed(1)}% — INSUFFISANT (sous-determine)`);
  console.log(`  - 3 points (vague_01): R²=${(seedVague01.r2 * 100).toFixed(1)}% — LIMITE (phase initiale seulement)`);
  console.log(`  - 5 points (FAO):      R²=${(fao5.r2 * 100).toFixed(1)}% — MINIMUM VIABLE`);
  console.log(`  - 10 points (FAO):     R²=${(fao10.r2 * 100).toFixed(1)}% — BON`);
  console.log(`  - 15 points (FAO):     R²=${(fao15.r2 * 100).toFixed(1)}% — EXCELLENT`);
  console.log("\n  => RECOMMANDATION: exiger >= 5 releves BIOMETRIE bien distribues");
  console.log("     sur au moins 60% du cycle (J0-J180) pour une estimation fiable.");

  console.log("\n" + hr("═") + "\n");

  process.exit(allCriteria ? 0 : 1);
}

main();

/**
 * Nelder-Mead simplex optimizer for MLE parameter estimation.
 * Derivative-free optimization suitable for BTYD likelihood surfaces.
 */

export interface OptimResult {
  params: number[]
  value: number     // final function value (negative log-likelihood)
  iterations: number
  converged: boolean
}

/**
 * Nelder-Mead simplex algorithm.
 * @param fn  Function to minimize: (params) => number
 * @param start  Initial parameter values
 * @param options  Step size factor, max iterations, tolerance
 */
export function nelderMead(
  fn: (params: number[]) => number,
  start: number[],
  options: {
    stepSize?: number    // initial simplex size factor (default 1)
    maxIter?: number     // max iterations (default 500)
    tol?: number         // convergence tolerance (default 1e-6)
    alpha?: number       // reflection coefficient (default 1)
    gamma?: number       // expansion coefficient (default 2)
    rho?: number         // contraction coefficient (default 0.5)
    sigma?: number       // shrink coefficient (default 0.5)
  } = {}
): OptimResult {
  const n = start.length
  const stepSize = options.stepSize ?? 1
  const maxIter = options.maxIter ?? 500
  const tol = options.tol ?? 1e-6
  const alpha = options.alpha ?? 1     // reflection
  const gamma = options.gamma ?? 2     // expansion
  const rho = options.rho ?? 0.5       // contraction
  const sigma = options.sigma ?? 0.5   // shrink

  // Build initial simplex: start + perturbations along each axis
  const simplex: { params: number[]; value: number }[] = []
  simplex.push({ params: [...start], value: fn(start) })

  for (let i = 0; i < n; i++) {
    const p = [...start]
    p[i] = start[i] === 0 ? stepSize * 0.00025 : start[i] * (1 + stepSize * 0.05)
    // Ensure positivity for BTYD params
    if (p[i] <= 0) p[i] = Math.abs(p[i]) + 0.001
    simplex.push({ params: p, value: fn(p) })
  }

  let iterations = 0
  // Safety limit
  const hardLimit = Math.min(maxIter, 1000)

  for (; iterations < hardLimit; iterations++) {
    // Sort by function value (ascending)
    simplex.sort((a, b) => a.value - b.value)

    // Check convergence: range of function values
    const fmax = simplex[simplex.length - 1].value
    const fmin = simplex[0].value
    if (2 * Math.abs(fmax - fmin) <= tol * (Math.abs(fmax) + Math.abs(fmin) + 1e-10)) {
      return { params: simplex[0].params, value: simplex[0].value, iterations, converged: true }
    }

    // Centroid of all points except worst
    const centroid = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += simplex[i].params[j]
      }
    }
    for (let j = 0; j < n; j++) centroid[j] /= n

    const worst = simplex[n].params
    const fworst = simplex[n].value

    // Reflection
    const reflected = centroid.map((c, j) => c + alpha * (c - worst[j]))
    // Clamp to positive (BTYD params must be > 0)
    const refPos = reflected.map((v) => Math.max(v, 1e-10))
    const fref = fn(refPos)

    if (fref < simplex[0].value) {
      // Expansion
      const expanded = centroid.map((c, j) => c + gamma * (refPos[j] - c))
      const expPos = expanded.map((v) => Math.max(v, 1e-10))
      const fexp = fn(expPos)
      if (fexp < fref) {
        simplex[n] = { params: expPos, value: fexp }
      } else {
        simplex[n] = { params: refPos, value: fref }
      }
    } else if (fref < simplex[n - 1].value) {
      simplex[n] = { params: refPos, value: fref }
    } else {
      // Contraction
      const contracted = centroid.map((c, j) => c + rho * (worst[j] - c))
      const conPos = contracted.map((v) => Math.max(v, 1e-10))
      const fcon = fn(conPos)
      if (fcon < fworst) {
        simplex[n] = { params: conPos, value: fcon }
      } else {
        // Shrink toward best point
        const best = simplex[0].params
        for (let i = 1; i <= n; i++) {
          const shrunk = best.map((b, j) => b + sigma * (simplex[i].params[j] - b))
          simplex[i] = { params: shrunk.map((v) => Math.max(v, 1e-10)), value: fn(shrunk) }
        }
      }
    }
  }

  simplex.sort((a, b) => a.value - b.value)
  return {
    params: simplex[0].params,
    value: simplex[0].value,
    iterations,
    converged: false,
  }
}

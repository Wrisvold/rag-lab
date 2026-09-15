// Principal component analysis, for the 2D map. Pure, no DOM.
//
// PCA finds the directions along which a cloud of vectors is most spread out.
// Projecting every vector onto the top two directions gives a flat picture
// that keeps as much of the spread as two numbers can. Implemented with power
// iteration and deflation, which is plenty for a few hundred chunks.

/**
 * @param {ArrayLike<number>[]} vectors  all the same length
 * @param {{ components?: number, iterations?: number }} [options]
 * @returns {{ mean: Float64Array, components: Float64Array[], variances: number[] }}
 */
export function fitPca(vectors, options = {}) {
  const componentCount = options.components ?? 2;
  const iterations = options.iterations ?? 200;
  const n = vectors.length;
  const d = n ? vectors[0].length : 0;

  const mean = new Float64Array(d);
  for (const v of vectors) for (let j = 0; j < d; j += 1) mean[j] += v[j];
  for (let j = 0; j < d; j += 1) mean[j] /= n || 1;

  // Centered copy we can deflate in place.
  const rows = vectors.map((v) => {
    const row = new Float64Array(d);
    for (let j = 0; j < d; j += 1) row[j] = v[j] - mean[j];
    return row;
  });

  const components = [];
  const variances = [];
  for (let k = 0; k < componentCount; k += 1) {
    const component = powerIteration(rows, d, iterations);
    const scores = rows.map((row) => dot(row, component));
    let variance = 0;
    for (const s of scores) variance += s * s;
    variances.push(n > 1 ? variance / (n - 1) : 0);
    components.push(component);
    // Deflate: remove this direction so the next iteration finds the next one.
    rows.forEach((row, i) => {
      for (let j = 0; j < d; j += 1) row[j] -= scores[i] * component[j];
    });
  }
  return { mean, components, variances };
}

/** Project one vector onto the fitted components: [x, y, ...] */
export function applyPca(fit, vector) {
  const d = fit.mean.length;
  const centered = new Float64Array(d);
  for (let j = 0; j < d; j += 1) centered[j] = vector[j] - fit.mean[j];
  return fit.components.map((component) => dot(centered, component));
}

/** Convenience: fit on the vectors and return their 2D points. */
export function projectTo2D(vectors) {
  const fit = fitPca(vectors, { components: 2 });
  return { fit, points: vectors.map((v) => applyPca(fit, v)) };
}

// Finds the direction of greatest spread in `rows` (already centered).
function powerIteration(rows, d, iterations) {
  // Deterministic start: the sum of the rows, so we are never orthogonal to
  // the data by accident. Fall back to a fixed direction for symmetric data.
  let v = new Float64Array(d);
  for (const row of rows) for (let j = 0; j < d; j += 1) v[j] += Math.abs(row[j]) + row[j] * 0.5;
  if (norm(v) === 0) { for (let j = 0; j < d; j += 1) v[j] = 1 + (j % 3) * 0.1; }
  normalizeInPlace(v);

  for (let it = 0; it < iterations; it += 1) {
    // w = Xᵀ (X v)
    const w = new Float64Array(d);
    for (const row of rows) {
      const s = dot(row, v);
      if (s === 0) continue;
      for (let j = 0; j < d; j += 1) w[j] += s * row[j];
    }
    const length = norm(w);
    if (length < 1e-12) return new Float64Array(d); // no spread left
    for (let j = 0; j < d; j += 1) w[j] /= length;
    const change = distance(v, w);
    v = w;
    if (change < 1e-10) break;
  }
  return v;
}

function dot(a, b) { let s = 0; for (let j = 0; j < a.length; j += 1) s += a[j] * b[j]; return s; }
function norm(a) { return Math.sqrt(dot(a, a)); }
function normalizeInPlace(a) { const l = norm(a); if (l) for (let j = 0; j < a.length; j += 1) a[j] /= l; }
function distance(a, b) { let s = 0; for (let j = 0; j < a.length; j += 1) s += (a[j] - b[j]) ** 2; return Math.sqrt(s); }

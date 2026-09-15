// Cosine similarity: how closely two vectors point in the same direction.
// 1 means identical direction, 0 means nothing in common. Pure.
//
// For vectors with no negative entries (TF-IDF) the score stays within 0..1.
// Neural embeddings can have negative entries, so scores can dip below 0.

/**
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @returns {number} 0 when either vector is all zeros
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new RangeError('vectors must have the same length');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * A copy of the vector scaled to length 1 (an all-zero vector stays zero).
 * The map projects unit vectors, because cosine similarity only compares
 * directions; two chunks that point the same way should sit together even
 * if one is much longer than the other.
 */
export function unitVector(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const length = Math.sqrt(sum);
  const out = new Float64Array(vector.length);
  if (length === 0) return out;
  for (let i = 0; i < vector.length; i += 1) out[i] = vector[i] / length;
  return out;
}

// Artifact 3: the retrieved passages. Pure, no DOM.
//
// Exact retrieval: score every chunk against the question with cosine
// similarity, sort, and cut the list at TOP_K. No approximate search, no
// index. The notebook makes the same choice so students can see that
// retrieval is a ranking of everything, not a lookup.

import { cosineSimilarity } from './cosine.js';

/**
 * @param {ArrayLike<number>} queryVector
 * @param {ArrayLike<number>[]} chunkVectors
 * @returns {{ index: number, score: number, rank: number }[]}  every chunk, best first
 */
export function rankChunks(queryVector, chunkVectors) {
  const scored = chunkVectors.map((vector, index) => ({ index, score: cosineSimilarity(queryVector, vector) }));
  // Sort by score, then by chunk order so ties are stable and predictable.
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry, position) => ({ ...entry, rank: position + 1 }));
}

/**
 * The first k entries of a ranking. k is clamped to what exists, because
 * asking for 8 passages from a 5-chunk document is not an error.
 */
export function selectTopK(ranked, k) {
  const count = Math.max(0, Math.min(Math.floor(k), ranked.length));
  return ranked.slice(0, count);
}

/** Where a particular chunk landed in the ranking (1-based), or null. */
export function rankOf(ranked, chunkIndex) {
  const entry = ranked.find((r) => r.index === chunkIndex);
  return entry ? entry.rank : null;
}

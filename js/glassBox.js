// Glass Box embedding mode: TF-IDF, computed in plain JavaScript. Pure.
//
// Both embedding modes produce an object with the same shape, so the map,
// the retrieval station, and the run summary do not care which one is active:
//   { mode, label, dimensions, vectors, embedQuery(text), inspect(index), stats }
// Black Box (js/blackBox.js, Phase 5) returns the same shape.

import { tokenizeDetailed } from './tokenizer.js';
import { buildTfidfIndex, vectorFor, topTerms, nonZeroCount } from './tfidf.js';

/**
 * @param {{ text: string }[]} chunks
 * @param {{ stopwords: Set<string>, minTokenLength: number, topTermCount: number }} options
 */
export function embedChunksGlassBox(chunks, options) {
  const tokenized = chunks.map((chunk) => tokenizeDetailed(chunk.text, options));
  const index = buildTfidfIndex(tokenized.map((t) => t.tokens));
  const droppedStopwords = tokenized.reduce((sum, t) => sum + t.droppedStopwords, 0);
  const keptTokens = tokenized.reduce((sum, t) => sum + t.tokens.length, 0);

  return {
    mode: 'glass',
    dimensions: index.vocabulary.length,
    vectors: index.vectors,
    stats: { droppedStopwords, keptTokens },

    /** Embed a question with the same vocabulary and weights. */
    embedQuery(text) {
      const { tokens } = tokenizeDetailed(text, options);
      const known = unique(tokens.filter((word) => index.indexOf.has(word)));
      const unknown = unique(tokens.filter((word) => !index.indexOf.has(word)));
      const dropped = unique(
        (text || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/)
          .filter((word) => word && (word.length < options.minTokenLength || options.stopwords.has(word))),
      );
      return { vector: vectorFor(index, tokens), tokens, known, unknown, dropped };
    },

    /** What a student sees when they click a chunk. */
    // (unique() below keeps first occurrences, in order.)
    inspect(chunkIndex) {
      const vector = index.vectors[chunkIndex];
      return {
        dimensions: index.vocabulary.length,
        nonZero: nonZeroCount(vector),
        topTerms: topTerms(index, vector, options.topTermCount),
        tokenCount: tokenized[chunkIndex].tokens.length,
        droppedStopwords: tokenized[chunkIndex].droppedStopwords,
      };
    },
  };
}

function unique(words) {
  return [...new Set(words)];
}

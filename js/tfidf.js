// Artifact 2 (Glass Box): TF-IDF vectors. Pure, no DOM.
//
// Every dimension of a vector is a word from the document. The weight of a
// word in a chunk is:
//   TF  = how often the word appears in the chunk / how many words the chunk has
//   IDF = ln(number of chunks / number of chunks containing the word)
// A word that appears in every chunk gets IDF 0: it cannot tell chunks apart,
// so it is worth nothing for retrieval. That is a lesson, not a bug.

/**
 * Build the vocabulary, the IDF table, and one vector per chunk.
 * @param {string[][]} tokenizedChunks  the tokens of each chunk
 * @returns {{ vocabulary: string[], indexOf: Map<string, number>, idf: Float64Array, vectors: Float64Array[] }}
 */
export function buildTfidfIndex(tokenizedChunks) {
  const documentFrequency = new Map();
  for (const tokens of tokenizedChunks) {
    for (const word of new Set(tokens)) {
      documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
    }
  }
  const vocabulary = [...documentFrequency.keys()].sort();
  const indexOf = new Map(vocabulary.map((word, i) => [word, i]));
  const chunkCount = tokenizedChunks.length;
  const idf = new Float64Array(vocabulary.length);
  vocabulary.forEach((word, i) => {
    idf[i] = chunkCount ? Math.log(chunkCount / documentFrequency.get(word)) : 0;
  });
  const index = { vocabulary, indexOf, idf };
  index.vectors = tokenizedChunks.map((tokens) => vectorFor(index, tokens));
  return index;
}

/**
 * Turn a token list into a TF-IDF vector using an existing index. Words that
 * are not in the vocabulary are ignored: the index has no dimension for them.
 * This is how a question is embedded in Glass Box mode.
 */
export function vectorFor(index, tokens) {
  const vector = new Float64Array(index.vocabulary.length);
  if (!tokens.length) return vector;
  const counts = new Map();
  for (const word of tokens) counts.set(word, (counts.get(word) || 0) + 1);
  for (const [word, count] of counts) {
    const i = index.indexOf.get(word);
    if (i === undefined) continue;
    vector[i] = (count / tokens.length) * index.idf[i];
  }
  return vector;
}

/**
 * The heaviest dimensions of a vector, for the inspector.
 * @returns {{ term: string, weight: number }[]}
 */
export function topTerms(index, vector, limit) {
  const terms = [];
  for (let i = 0; i < vector.length; i += 1) {
    if (vector[i] > 0) terms.push({ term: index.vocabulary[i], weight: vector[i] });
  }
  terms.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
  return terms.slice(0, limit);
}

/** How many dimensions of a vector are not zero. */
export function nonZeroCount(vector) {
  let count = 0;
  for (let i = 0; i < vector.length; i += 1) if (vector[i] !== 0) count += 1;
  return count;
}

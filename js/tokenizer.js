// Turns text into a list of words for Glass Box (TF-IDF) mode. Pure.
//
// Rules, in order: lowercase; drop apostrophes ("Year's" -> "years"); split on
// anything that is not a letter or digit; drop tokens shorter than
// minTokenLength; drop stopwords. The stopword list and the minimum length
// live in js/constants.js so the instructor can change them.

/**
 * @param {string} text
 * @param {{ stopwords: Set<string>, minTokenLength: number }} options
 * @returns {{ tokens: string[], droppedStopwords: number, droppedShort: number }}
 */
export function tokenizeDetailed(text, options) {
  const stopwords = options.stopwords || new Set();
  const minTokenLength = options.minTokenLength ?? 2;
  const tokens = [];
  let droppedStopwords = 0;
  let droppedShort = 0;

  const raw = (text || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/);
  for (const word of raw) {
    if (!word) continue;
    if (word.length < minTokenLength) { droppedShort += 1; continue; }
    if (stopwords.has(word)) { droppedStopwords += 1; continue; }
    tokens.push(word);
  }
  return { tokens, droppedStopwords, droppedShort };
}

/** Just the tokens. */
export function tokenize(text, options) {
  return tokenizeDetailed(text, options).tokens;
}

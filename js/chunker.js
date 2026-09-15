// Artifact 1: the chunks.
// Fixed-size character chunking with overlap. Pure: no DOM, no globals.
//
// EXTENSION POINT: a sentence- or paragraph-based chunker would be a sibling
// function here returning the same shape ({ chunks, summary }), so the cards
// and every later station keep working unchanged. Not built in v1 on purpose.

/**
 * @typedef {object} Chunk
 * @property {number} index            0-based position in the list
 * @property {number} number           1-based number shown to students
 * @property {number} start            index of the first character (inclusive)
 * @property {number} end              index just past the last character (exclusive)
 * @property {string} text             the chunk's characters
 * @property {number} length           text.length
 * @property {number} overlapWithPrevious  how many leading characters repeat the previous chunk (0 for the first)
 * @property {boolean} endsMidSentence   true when this chunk is cut off before a sentence ends
 */

/**
 * Split text into fixed-size chunks.
 *
 * @param {string} text
 * @param {{ chunkSize: number, chunkOverlap: number }} settings
 * @param {string[]} sentenceEndChars  characters that count as the end of a sentence
 * @returns {{ chunks: Chunk[], summary: { count: number, averageLength: number, boundaries: number, midSentenceCuts: number } }}
 * @throws {RangeError} with a `code` of 'INVALID_SIZE', 'INVALID_OVERLAP', or 'OVERLAP_TOO_LARGE'
 */
export function chunkText(text, settings, sentenceEndChars = ['.', '!', '?', '\n']) {
  const { chunkSize, chunkOverlap } = settings;
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw withCode(new RangeError('chunkSize must be a whole number of 1 or more'), 'INVALID_SIZE');
  }
  if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0) {
    throw withCode(new RangeError('chunkOverlap must be a whole number of 0 or more'), 'INVALID_OVERLAP');
  }
  if (chunkOverlap >= chunkSize) {
    throw withCode(new RangeError('chunkOverlap must be smaller than chunkSize'), 'OVERLAP_TOO_LARGE');
  }

  const source = typeof text === 'string' ? text : '';
  const chunks = [];
  let start = 0;

  while (start < source.length) {
    const end = Math.min(start + chunkSize, source.length);
    const isLast = end === source.length;
    const index = chunks.length;
    chunks.push({
      index,
      number: index + 1,
      start,
      end,
      text: source.slice(start, end),
      length: end - start,
      overlapWithPrevious: index === 0 ? 0 : chunks[index - 1].end - start,
      endsMidSentence: isLast ? false : isMidSentenceCut(source, end, sentenceEndChars),
    });
    if (isLast) break;
    start = end - chunkOverlap;
  }

  const boundaries = Math.max(0, chunks.length - 1);
  const midSentenceCuts = chunks.filter((chunk) => chunk.endsMidSentence).length;
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  return {
    chunks,
    summary: {
      count: chunks.length,
      averageLength: chunks.length ? Math.round(totalLength / chunks.length) : 0,
      boundaries,
      midSentenceCuts,
    },
  };
}

/**
 * Is a cut at `position` (the index of the first character *after* the cut)
 * in the middle of a sentence? Spaces and tabs just before the cut are
 * skipped, so a cut right after "Day. " counts as a clean cut.
 *
 * @param {string} text
 * @param {number} position
 * @param {string[]} sentenceEndChars
 * @returns {boolean}
 */
export function isMidSentenceCut(text, position, sentenceEndChars = ['.', '!', '?', '\n']) {
  let i = position - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t' || text[i] === '\r')) i -= 1;
  if (i < 0) return false;
  return !sentenceEndChars.includes(text[i]);
}

function withCode(error, code) {
  error.code = code;
  return error;
}

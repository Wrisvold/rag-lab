// The "Copy run summary" block: plain text a student pastes into an
// assignment. The format is fixed so an instructor can read many of them
// quickly. Pure, no DOM.
//
//   RAG Lab run — 2026-09-15 14:02
//   Document: sample.txt (1,240 words)
//   CHUNK_SIZE=400  CHUNK_OVERLAP=50  → 18 chunks, 6 mid-sentence cuts
//   Mode: Glass Box (TF-IDF, 1,284 dims)
//   Question: How many days of PTO do new employees get?
//   TOP_K=3
//     1. chunk 07  score 0.21
//     2. chunk 02  score 0.19
//     3. chunk 11  score 0.17
//   Prompt length: 1,412 chars

const number = (value) => Number(value).toLocaleString('en-US');

/**
 * @param {object} run
 * @param {Date} run.date
 * @param {string} run.documentName
 * @param {number} run.words
 * @param {number} run.chunkSize
 * @param {number} run.chunkOverlap
 * @param {number} run.chunkCount
 * @param {number} run.midSentenceCuts
 * @param {string} run.modeLabel        e.g. "Glass Box (TF-IDF, 1,284 dims)"
 * @param {string} run.question
 * @param {number} run.topK
 * @param {{ rank: number, chunkLabel: string, score: number }[]} run.results
 * @param {number} run.promptLength
 * @returns {string}
 */
export function formatRunSummary(run) {
  const lines = [
    `RAG Lab run — ${formatDateTime(run.date)}`,
    `Document: ${run.documentName} (${number(run.words)} words)`,
    `CHUNK_SIZE=${run.chunkSize}  CHUNK_OVERLAP=${run.chunkOverlap}  → ${number(run.chunkCount)} chunks, ${number(run.midSentenceCuts)} mid-sentence cuts`,
    `Mode: ${run.modeLabel}`,
    `Question: ${run.question}`,
    `TOP_K=${run.topK}`,
    ...run.results.map((r) => `  ${r.rank}. chunk ${r.chunkLabel}  score ${r.score.toFixed(2)}`),
    `Prompt length: ${number(run.promptLength)} chars`,
  ];
  return lines.join('\n');
}

/** Local time as "2026-09-15 14:02". */
export function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

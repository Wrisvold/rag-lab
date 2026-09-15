// Re-checks the synonym probe with the REAL neural model, outside the browser.
// Run this after editing data/sample.txt or the sample questions.
//
//   npm install --no-save @xenova/transformers@2.17.2   (once; ~100 MB, dev only)
//   node tools/probe.mjs                                  (or: node tools/probe.mjs path/to/other.txt)
//
// It prints, for each sample question and each mode, where the vacation chunk
// ranks and how far ahead or behind the best other chunk it is. The
// centrepiece demonstration needs: Glass Box rank > TOP_K, Black Box rank 1.
// The margins are small with a 23 MB model, so re-run this after any edit.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const jsUrl = (name) => new URL(`../js/${name}`, import.meta.url);

const { chunkText } = await import(jsUrl('chunker.js'));
const { embedChunksGlassBox } = await import(jsUrl('glassBox.js'));
const { rankChunks } = await import(jsUrl('retrieval.js'));
const { SAMPLE_QUESTIONS } = await import(jsUrl('copy.js'));
const C = await import(jsUrl('constants.js'));

let transformers;
try {
  transformers = await import('@xenova/transformers');
} catch {
  console.error('Transformers.js is not installed. Run: npm install --no-save @xenova/transformers@2.17.2');
  process.exit(1);
}

const file = process.argv[2] || join(root, C.SAMPLE_DOCUMENT_PATH);
const text = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const { chunks, summary } = chunkText(text, { chunkSize: C.CHUNK_SIZE_DEFAULT, chunkOverlap: C.CHUNK_OVERLAP_DEFAULT }, C.SENTENCE_END_CHARS);
const vacation = chunks.find((c) => /ten vacation days a year/.test(c.text));
console.log(`${file}\n${summary.count} chunks at CHUNK_SIZE=${C.CHUNK_SIZE_DEFAULT} CHUNK_OVERLAP=${C.CHUNK_OVERLAP_DEFAULT}; vacation chunk = ${vacation ? vacation.number : 'NOT FOUND'}`);
if (!vacation) process.exit(1);

transformers.env.allowLocalModels = false;
const extractor = await transformers.pipeline('feature-extraction', C.BLACK_BOX_MODEL, { quantized: true });
const embed = async (texts) => (await extractor(texts, { pooling: 'mean', normalize: true })).tolist().map((r) => Float64Array.from(r));
const blackVectors = await embed(chunks.map((c) => c.text));
const glass = embedChunksGlassBox(chunks, { stopwords: C.STOPWORDS, minTokenLength: C.MIN_TOKEN_LENGTH, topTermCount: C.GLASS_BOX_TOP_TERMS });

const report = (ranked) => {
  const v = ranked.find((r) => r.index === vacation.index);
  const other = ranked.find((r) => r.index !== vacation.index);
  const margin = v.score - other.score;
  return `rank ${v.rank} (score ${v.score.toFixed(3)}, ${margin >= 0 ? '+' : ''}${margin.toFixed(3)} vs chunk ${String(other.index + 1).padStart(2, '0')})`;
};

let ok = true;
for (const q of SAMPLE_QUESTIONS) {
  const g = rankChunks(glass.embedQuery(q.text).vector, glass.vectors);
  const [qv] = await embed([q.text]);
  const b = rankChunks(qv, blackVectors);
  console.log(`\n${q.label}: ${q.text}\n  Glass Box: ${report(g)}\n  Black Box: ${report(b)}`);
  if (q.key === 'synonym') {
    const glassRank = g.find((r) => r.index === vacation.index).rank;
    const blackRank = b.find((r) => r.index === vacation.index).rank;
    ok = glassRank > C.TOP_K_DEFAULT && blackRank === 1;
    console.log(ok ? '  PASS: outside the top k in Glass Box, rank 1 in Black Box.' : '  FAIL: the centrepiece demonstration does not hold with this text.');
  }
}
process.exit(ok ? 0 : 1);

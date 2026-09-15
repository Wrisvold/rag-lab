import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rankChunks, selectTopK, rankOf } from '../js/retrieval.js';
import { chunkText } from '../js/chunker.js';
import { embedChunksGlassBox } from '../js/glassBox.js';
import { SAMPLE_QUESTIONS } from '../js/copy.js';
import {
  CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP_DEFAULT, TOP_K_DEFAULT, SENTENCE_END_CHARS,
  STOPWORDS, MIN_TOKEN_LENGTH, GLASS_BOX_TOP_TERMS,
} from '../js/constants.js';

test('ranks every chunk, best first, with 1-based ranks', () => {
  const ranked = rankChunks([1, 0], [[0, 1], [1, 0], [1, 1]]);
  assert.deepEqual(ranked.map((r) => r.index), [1, 2, 0]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
  assert.equal(ranked[0].score, 1);
});

test('ties keep chunk order', () => {
  const ranked = rankChunks([1, 1], [[1, 1], [2, 2], [0, 1]]);
  assert.deepEqual(ranked.map((r) => r.index), [0, 1, 2]);
});

test('selectTopK cuts the list and tolerates k larger than the list', () => {
  const ranked = rankChunks([1, 0], [[1, 0], [0, 1]]);
  assert.equal(selectTopK(ranked, 1).length, 1);
  assert.equal(selectTopK(ranked, 8).length, 2);
  assert.equal(selectTopK(ranked, 0).length, 0);
});

test('a zero query vector scores everything 0 and keeps chunk order', () => {
  const ranked = rankChunks([0, 0], [[1, 0], [0, 1]]);
  assert.deepEqual(ranked.map((r) => [r.index, r.score]), [[0, 0], [1, 0]]);
});

// ---------------------------------------------------------------------------
// The centrepiece: the synonym probe on the real sample document, Glass Box side.
// (The Black Box side is checked by hand; see STATUS.md, Phase 5.)
// ---------------------------------------------------------------------------
async function sampleGlassBox() {
  const handbook = await readFile(new URL('../data/sample.txt', import.meta.url), 'utf8');
  const { chunks } = chunkText(handbook, { chunkSize: CHUNK_SIZE_DEFAULT, chunkOverlap: CHUNK_OVERLAP_DEFAULT }, SENTENCE_END_CHARS);
  const embedding = embedChunksGlassBox(chunks, { stopwords: STOPWORDS, minTokenLength: MIN_TOKEN_LENGTH, topTermCount: GLASS_BOX_TOP_TERMS });
  return { chunks, embedding };
}

const question = (key) => SAMPLE_QUESTIONS.find((q) => q.key === key).text;

test('synonym probe: "PTO" is not in the vocabulary and the vacation chunk is outside the top 3', async () => {
  const { chunks, embedding } = await sampleGlassBox();
  const query = embedding.embedQuery(question('synonym'));
  assert.ok(query.unknown.includes('pto'), 'pto should be an unknown word');
  const ranked = rankChunks(query.vector, embedding.vectors);
  const vacationChunk = chunks.find((c) => /ten vacation days a year/.test(c.text));
  assert.ok(vacationChunk, 'the accrual sentence must sit in one chunk');
  const rank = rankOf(ranked, vacationChunk.index);
  assert.ok(rank > TOP_K_DEFAULT, `vacation chunk ranked ${rank}; it must be outside the top ${TOP_K_DEFAULT} in Glass Box`);
  const top = selectTopK(ranked, TOP_K_DEFAULT);
  assert.ok(top.every((r) => !/ten vacation days a year/.test(chunks[r.index].text)), 'no top-k chunk should carry the vacation allowance');
});

test('direct match: the expense chunk is rank 1 in Glass Box', async () => {
  const { chunks, embedding } = await sampleGlassBox();
  const query = embedding.embedQuery(question('lexical'));
  const ranked = rankChunks(query.vector, embedding.vectors);
  assert.match(chunks[ranked[0].index].text, /expense/i);
  assert.match(chunks[ranked[0].index].text, /submitted/i);
});

test('grounding probe: nothing in the document mentions parental leave', async () => {
  const { chunks, embedding } = await sampleGlassBox();
  assert.ok(chunks.every((c) => !/parental/i.test(c.text)));
  const query = embedding.embedQuery(question('grounding'));
  assert.ok(query.unknown.includes('parental'));
  // It still retrieves something (the leave policies), which is the point:
  // retrieval always returns k chunks, relevant or not.
  const ranked = rankChunks(query.vector, embedding.vectors);
  assert.ok(ranked[0].score > 0);
});

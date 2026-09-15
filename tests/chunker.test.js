import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chunkText, isMidSentenceCut } from '../js/chunker.js';
import { CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP_DEFAULT, SENTENCE_END_CHARS } from '../js/constants.js';

test('rejects overlap equal to or larger than the chunk size', () => {
  assert.throws(() => chunkText('abc', { chunkSize: 10, chunkOverlap: 10 }), { code: 'OVERLAP_TOO_LARGE' });
  assert.throws(() => chunkText('abc', { chunkSize: 10, chunkOverlap: 20 }), { code: 'OVERLAP_TOO_LARGE' });
});

test('rejects nonsense sizes', () => {
  assert.throws(() => chunkText('abc', { chunkSize: 0, chunkOverlap: 0 }), { code: 'INVALID_SIZE' });
  assert.throws(() => chunkText('abc', { chunkSize: 10, chunkOverlap: -1 }), { code: 'INVALID_OVERLAP' });
  assert.throws(() => chunkText('abc', { chunkSize: 2.5, chunkOverlap: 0 }), { code: 'INVALID_SIZE' });
});

test('empty input gives zero chunks and a zeroed summary', () => {
  for (const input of ['', null, undefined]) {
    const result = chunkText(input, { chunkSize: 10, chunkOverlap: 2 });
    assert.deepEqual(result.chunks, []);
    assert.deepEqual(result.summary, { count: 0, averageLength: 0, boundaries: 0, midSentenceCuts: 0 });
  }
});

test('chunks cover the text with the requested size and overlap', () => {
  const text = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
  const { chunks, summary } = chunkText(text, { chunkSize: 10, chunkOverlap: 3 });
  assert.deepEqual(chunks.map((c) => [c.start, c.end]), [[0, 10], [7, 17], [14, 24], [21, 26]]);
  assert.equal(chunks[0].overlapWithPrevious, 0);
  assert.equal(chunks[1].overlapWithPrevious, 3);
  assert.equal(chunks[1].text, 'hijklmnopq');
  assert.equal(chunks[1].number, 2);
  assert.equal(summary.count, 4);
  assert.equal(summary.boundaries, 3);
});

test('the last chunk is shorter than the chunk size and is never a mid-sentence cut', () => {
  const { chunks } = chunkText('one two three four five', { chunkSize: 10, chunkOverlap: 0 });
  const last = chunks[chunks.length - 1];
  assert.ok(last.length < 10);
  assert.equal(last.text, 'ive');
  assert.equal(last.endsMidSentence, false);
});

test('text exactly one chunk long produces a single chunk', () => {
  const { chunks } = chunkText('x'.repeat(10), { chunkSize: 10, chunkOverlap: 3 });
  assert.equal(chunks.length, 1);
});

test('zero overlap is allowed', () => {
  const { chunks } = chunkText('abcdef', { chunkSize: 3, chunkOverlap: 0 });
  assert.deepEqual(chunks.map((c) => c.text), ['abc', 'def']);
});

test('mid-sentence detection follows the sentence-end characters', () => {
  const text = 'Hello world. Bye now!';
  assert.equal(isMidSentenceCut(text, 5), true);   // cut after "Hello"
  assert.equal(isMidSentenceCut(text, 12), false); // cut right after the period
  assert.equal(isMidSentenceCut(text, 13), false); // cut after the period and a space
  assert.equal(isMidSentenceCut(text, 21), false); // cut after "!"
  assert.equal(isMidSentenceCut('line one\nline two', 9), false); // newline ends a sentence
  assert.equal(isMidSentenceCut(text, 0), false);
});

test('summary counts mid-sentence cuts', () => {
  // "abcde. fghij" cut at 6 -> clean
  const clean = chunkText('abcde. fghij', { chunkSize: 6, chunkOverlap: 0 });
  assert.equal(clean.summary.midSentenceCuts, 0);
  // "abcdefghij. kl" cut at 5 (after "e") and 10 (after "j") -> both mid-sentence
  const mid = chunkText('abcdefghij. kl', { chunkSize: 5, chunkOverlap: 0 });
  assert.equal(mid.chunks[0].endsMidSentence, true);
  assert.equal(mid.chunks[1].endsMidSentence, true);
  assert.equal(mid.chunks[2].endsMidSentence, false);
  assert.equal(mid.summary.midSentenceCuts, 2);
});

test('at the default settings the sample handbook splits policy 3.1 (Vacation) across a boundary', async () => {
  const handbook = await readFile(new URL('../data/sample.txt', import.meta.url), 'utf8');
  const { chunks, summary } = chunkText(handbook, { chunkSize: CHUNK_SIZE_DEFAULT, chunkOverlap: CHUNK_OVERLAP_DEFAULT }, SENTENCE_END_CHARS);
  const policyStart = handbook.indexOf('3.1 Vacation.');
  const policyEnd = handbook.indexOf('3.2 Paid Holidays.');
  assert.ok(policyStart > 0 && policyEnd > policyStart, 'expected policy 3.1 Vacation followed by 3.2 Paid Holidays');
  const straddling = chunks.filter((c) => c.start > policyStart && c.start < policyEnd);
  assert.ok(straddling.length >= 1, 'no chunk boundary falls inside policy 3.1');
  assert.ok(straddling.every((c) => chunks[c.index - 1].endsMidSentence), 'the straddling cut should be flagged mid-sentence');
  assert.ok(summary.midSentenceCuts >= 1);
});

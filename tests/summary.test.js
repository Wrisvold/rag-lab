import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRunSummary, formatDateTime } from '../js/summary.js';

test('produces exactly the format in the brief', () => {
  const summary = formatRunSummary({
    date: new Date(2026, 8, 15, 14, 2),
    documentName: 'sample.txt',
    words: 1240,
    chunkSize: 400,
    chunkOverlap: 50,
    chunkCount: 18,
    midSentenceCuts: 6,
    modeLabel: 'Glass Box (TF-IDF, 1,284 dims)',
    question: 'How much PTO do new employees get?',
    topK: 3,
    results: [
      { rank: 1, chunkLabel: '07', score: 0.21 },
      { rank: 2, chunkLabel: '02', score: 0.19 },
      { rank: 3, chunkLabel: '11', score: 0.17 },
    ],
    promptLength: 1412,
  });
  assert.equal(summary, [
    'RAG Lab run — 2026-09-15 14:02',
    'Document: sample.txt (1,240 words)',
    'CHUNK_SIZE=400  CHUNK_OVERLAP=50  → 18 chunks, 6 mid-sentence cuts',
    'Mode: Glass Box (TF-IDF, 1,284 dims)',
    'Question: How much PTO do new employees get?',
    'TOP_K=3',
    '  1. chunk 07  score 0.21',
    '  2. chunk 02  score 0.19',
    '  3. chunk 11  score 0.17',
    'Prompt length: 1,412 chars',
  ].join('\n'));
});

test('scores are rounded to two decimals and numbers get thousands separators', () => {
  const summary = formatRunSummary({
    date: new Date(2026, 0, 5, 9, 7), documentName: 'a.docx', words: 12345, chunkSize: 100, chunkOverlap: 0,
    chunkCount: 1234, midSentenceCuts: 1000, modeLabel: 'M', question: 'Q', topK: 1,
    results: [{ rank: 1, chunkLabel: '0001', score: 0.125 }], promptLength: 10000,
  });
  assert.match(summary, /2026-01-05 09:07/);
  assert.match(summary, /12,345 words/);
  assert.match(summary, /1,234 chunks, 1,000 mid-sentence cuts/);
  assert.match(summary, /score 0\.13/);
  assert.match(summary, /Prompt length: 10,000 chars/);
});

test('formatDateTime pads to two digits', () => {
  assert.equal(formatDateTime(new Date(2026, 8, 5, 4, 9)), '2026-09-05 04:09');
});

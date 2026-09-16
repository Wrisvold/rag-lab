import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { flowGraphSummary } from '../../js/flow/summary.js';
import { canonicalGraph } from '../../js/flow/presets.js';
import { addNode } from '../../js/flow/graph.js';
import { runGraph } from '../../js/flow/runner.js';
import { SAMPLE_QUESTIONS, FLOW } from '../../js/copy.js';

const handbook = () => readFile(new URL('../../data/sample.txt', import.meta.url), 'utf8');

test('the flow summary lists every node in order with sources, parameters, and results', async () => {
  const { graph } = canonicalGraph({ text: await handbook(), question: SAMPLE_QUESTIONS[0].text });
  addNode(graph, 'note', { params: { text: 'Look at chunk 08.\nThen look at 02.' } });
  await runGraph(graph);
  const summary = flowGraphSummary(graph, { date: new Date(2026, 8, 16, 14, 2) });
  assert.equal(summary, [
    'RAG Lab flow — 2026-09-16 14:02',
    '1. Document · sample.txt · 1,105 words',
    '2. Chunk (from 1) · CHUNK_SIZE=400  CHUNK_OVERLAP=50 · 20 chunks, 19 mid-sentence cuts',
    '3. Embed (from 2) · Glass Box (TF-IDF) · 392 dims',
    '4. Question · How many days of PTO do new employees get?',
    '5. Retrieve (from 3, 4) · TOP_K=3 · chunks 02, 03, 07 · scores 0.19, 0.10, 0.08',
    '6. Assemble (from 5, 4) · 1,467 chars',
    '7. Answer (from 6) · Google Gemini · not run',
    'Note · Look at chunk 08. Then look at 02.',
  ].join('\n'));
});

test('an unrun graph still summarises, and notes never take a number', () => {
  const { graph } = canonicalGraph({ text: 'abc', name: 'mine.txt', question: 'Q?' });
  const lines = flowGraphSummary(graph, { date: new Date(2026, 0, 1, 0, 0) }).split('\n');
  assert.equal(lines[1], `1. Document · mine.txt · ${FLOW.summaries.notRun}`);
  assert.equal(lines[4], `4. Question · Q? · ${FLOW.summaries.notRun}`);
  assert.equal(lines.length, 8);
});

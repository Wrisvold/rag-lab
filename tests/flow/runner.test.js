import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runGraph, runNode } from '../../js/flow/runner.js';
import { createGraph, addNode, connect, setParam, isStale } from '../../js/flow/graph.js';
import { canonicalGraph } from '../../js/flow/presets.js';
import { flowRunSummary } from '../../js/flow/summary.js';
import { chunkText } from '../../js/chunker.js';
import { embedChunksGlassBox } from '../../js/glassBox.js';
import { rankChunks, rankOf } from '../../js/retrieval.js';
import { buildPrompt } from '../../js/prompt.js';
import { formatRunSummary } from '../../js/summary.js';
import { padNumber } from '../../js/text.js';
import { SAMPLE_QUESTIONS } from '../../js/copy.js';
import {
  CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP_DEFAULT, TOP_K_DEFAULT, SENTENCE_END_CHARS,
  STOPWORDS, MIN_TOKEN_LENGTH, GLASS_BOX_TOP_TERMS, DEFAULT_INSTRUCTION, SAMPLE_DOCUMENT_NAME,
} from '../../js/constants.js';

const handbook = () => readFile(new URL('../../data/sample.txt', import.meta.url), 'utf8');
const question = (key) => SAMPLE_QUESTIONS.find((q) => q.key === key).text;
const port = (node, id) => ({ node: node.id, port: id });

test('the canonical Glass Box graph reproduces the walkthrough exactly', async () => {
  const text = await handbook();
  const { graph, ids } = canonicalGraph({ text, question: question('synonym') });
  const report = await runGraph(graph);

  assert.deepEqual(report.failed.map((f) => [f.id, f.code]), [[ids.answer, 'badKey']], 'only the answer node fails, for want of a key');
  assert.deepEqual(report.ran, [ids.document, ids.chunk, ids.embed, ids.question, ids.retrieve, ids.assemble]);
  assert.deepEqual(report.skipped, []);

  // The same computation done by hand, the way tests/retrieval.test.js does it.
  const { chunks } = chunkText(text, { chunkSize: CHUNK_SIZE_DEFAULT, chunkOverlap: CHUNK_OVERLAP_DEFAULT }, SENTENCE_END_CHARS);
  const embedding = embedChunksGlassBox(chunks, { stopwords: STOPWORDS, minTokenLength: MIN_TOKEN_LENGTH, topTermCount: GLASS_BOX_TOP_TERMS });
  const ranked = rankChunks(embedding.embedQuery(question('synonym')).vector, embedding.vectors);

  const passages = graph.nodes.get(ids.retrieve).artifact.output;
  assert.deepEqual(passages.ranked.map((r) => [r.index, r.score]), ranked.map((r) => [r.index, r.score]));
  assert.equal(passages.topK.length, TOP_K_DEFAULT);

  const vacation = chunks.find((c) => /ten vacation days a year/.test(c.text));
  assert.ok(rankOf(passages.ranked, vacation.index) > TOP_K_DEFAULT, 'the synonym probe still fails in Glass Box');

  const prompt = graph.nodes.get(ids.assemble).artifact.output;
  assert.equal(prompt.text, buildPrompt({
    instruction: DEFAULT_INSTRUCTION,
    passages: passages.topK.map((e) => ({ text: chunks[e.index].text })),
    question: question('synonym'),
  }));

  const date = new Date(2026, 8, 16, 10, 0);
  const expected = formatRunSummary({
    date,
    documentName: SAMPLE_DOCUMENT_NAME,
    words: text.trim().split(/\s+/).length,
    chunkSize: CHUNK_SIZE_DEFAULT,
    chunkOverlap: CHUNK_OVERLAP_DEFAULT,
    chunkCount: chunks.length,
    midSentenceCuts: chunks.filter((c) => c.endsMidSentence).length,
    modeLabel: `Glass Box (TF-IDF, ${embedding.dimensions.toLocaleString('en-US')} dims)`,
    question: question('synonym'),
    topK: TOP_K_DEFAULT,
    results: passages.topK.map((e) => ({ rank: e.rank, chunkLabel: padNumber(chunks[e.index].number, chunks.length), score: e.score })),
    promptLength: prompt.text.length,
  });
  assert.equal(flowRunSummary(graph, ids.assemble, { date }), expected);
});

test('a second run re-runs nothing; a dial change re-runs only what depends on it', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  await runGraph(graph);
  const again = await runGraph(graph);
  assert.deepEqual(again.ran, []);
  assert.equal(again.fresh.length, 6);
  assert.equal(again.failed.length, 1, 'the answer node fails again because it never got an artifact');

  setParam(graph, ids.retrieve, 'topK', 1);
  assert.equal(isStale(graph, ids.retrieve), true);
  assert.equal(isStale(graph, ids.assemble), true);
  const after = await runGraph(graph);
  assert.deepEqual(after.ran, [ids.retrieve, ids.assemble]);
  assert.equal(graph.nodes.get(ids.retrieve).artifact.output.topK.length, 1);
  assert.equal(isStale(graph, ids.assemble), false);
});

test('runNode runs stale ancestors first and always re-runs the target', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  setParam(graph, ids.chunk, 'chunkSize', 600);
  const report = await runNode(graph, ids.retrieve);
  assert.deepEqual(report.ran, [ids.document, ids.chunk, ids.embed, ids.question, ids.retrieve]);
  assert.equal(graph.nodes.get(ids.chunk).artifact.output.chunks.length, 13);
  const second = await runNode(graph, ids.retrieve);
  assert.deepEqual(second.ran, [ids.retrieve], 'only the target when nothing upstream changed');
  assert.equal(graph.nodes.get(ids.retrieve).runs, 2);
});

test('a failure clears the artifact and blocks everything downstream', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  setParam(graph, ids.chunk, 'chunkOverlap', 400);
  const errors = [];
  const report = await runGraph(graph, {}, { onError: (node, error) => errors.push([node.id, error.code]) });
  assert.deepEqual(errors, [[ids.chunk, 'OVERLAP_TOO_LARGE']]);
  assert.equal(graph.nodes.get(ids.chunk).artifact, null);
  assert.deepEqual(report.skipped.map((s) => [s.id, s.reason]), [
    [ids.embed, 'upstreamMissing'], [ids.retrieve, 'upstreamMissing'], [ids.assemble, 'upstreamMissing'], [ids.answer, 'upstreamMissing'],
  ]);
  assert.deepEqual(report.ran, [ids.document, ids.question]);

  setParam(graph, ids.chunk, 'chunkOverlap', CHUNK_OVERLAP_DEFAULT);
  const fixed = await runGraph(graph);
  assert.equal(graph.nodes.get(ids.chunk).error, null);
  assert.deepEqual(fixed.ran, [ids.chunk, ids.embed, ids.retrieve, ids.assemble]);
});

test('empty document and empty question are node errors, and a missing wire is a skip', async () => {
  const graph = createGraph();
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  const q = addNode(graph, 'question');
  const note = addNode(graph, 'note');
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  const report = await runGraph(graph);
  assert.deepEqual(report.failed.map((f) => [f.id, f.code]), [[doc.id, 'EMPTY_DOCUMENT'], [q.id, 'EMPTY_QUESTION']]);
  assert.deepEqual(report.skipped, [{ id: chunk.id, reason: 'upstreamMissing', nodes: [doc.id] }, { id: note.id, reason: 'notRunnable' }]);
  const embed = addNode(graph, 'embed');
  const second = await runGraph(graph);
  assert.ok(second.skipped.some((s) => s.id === embed.id && s.reason === 'missingInput' && s.ports[0] === 'chunks'));
});

test('two Embed nodes on one chunking give two retrievals for one question', async () => {
  const text = await handbook();
  const graph = createGraph();
  const doc = addNode(graph, 'document', { params: { text, name: 'x' } });
  const chunk = addNode(graph, 'chunk');
  const glass = addNode(graph, 'embed');
  const fake = addNode(graph, 'embed', { params: { mode: 'black' } });
  const q = addNode(graph, 'question', { params: { text: question('synonym') } });
  const r1 = addNode(graph, 'retrieve');
  const r2 = addNode(graph, 'retrieve');
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  connect(graph, port(chunk, 'chunks'), port(glass, 'chunks'));
  connect(graph, port(chunk, 'chunks'), port(fake, 'chunks'));
  connect(graph, port(glass, 'vectors'), port(r1, 'vectors'));
  connect(graph, port(fake, 'vectors'), port(r2, 'vectors'));
  connect(graph, port(q, 'question'), port(r1, 'question'));
  connect(graph, port(q, 'question'), port(r2, 'question'));

  // A stand-in for the neural model: every chunk is a one-hot vector and the
  // question always points at the vacation chunk, so rank 1 is known.
  let loads = 0;
  const progress = [];
  const blackBox = {
    async load(onProgress) { loads += 1; onProgress({ percent: 50 }); onProgress({ percent: 100 }); },
    async embed(chunks, onProgress) {
      onProgress({ done: 0, total: chunks.length });
      const target = chunks.findIndex((c) => /ten vacation days a year/.test(c.text));
      const vectors = chunks.map((c, i) => { const v = new Float64Array(chunks.length); v[i] = 1; return v; });
      onProgress({ done: chunks.length, total: chunks.length });
      return {
        mode: 'black', dimensions: chunks.length, vectors, stats: {},
        async embedQuery() { const v = new Float64Array(chunks.length); v[target] = 1; return { vector: v, tokens: [], known: [], unknown: [], dropped: [] }; },
        inspect() { return {}; },
      };
    },
  };
  const report = await runGraph(graph, { blackBox, onProgress: (p) => progress.push(p.stage) });
  assert.deepEqual(report.failed, []);
  assert.equal(loads, 1);
  assert.deepEqual([...new Set(progress)], ['download', 'embed']);

  const out1 = graph.nodes.get(r1.id).artifact.output;
  const out2 = graph.nodes.get(r2.id).artifact.output;
  const vacation = out1.chunks.findIndex((c) => /ten vacation days a year/.test(c.text));
  assert.ok(rankOf(out1.ranked, vacation) > TOP_K_DEFAULT, 'Glass Box misses');
  assert.equal(rankOf(out2.ranked, vacation), 1, 'the stand-in model hits');
  assert.equal(out1.mode, 'glass');
  assert.equal(out2.mode, 'black');
});

test('a Black Box load failure becomes BLACK_BOX_UNAVAILABLE on the Embed node', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical'), mode: 'black' });
  const blackBox = { async load() { throw new Error('offline'); }, async embed() { throw new Error('never'); } };
  const report = await runGraph(graph, { blackBox });
  assert.deepEqual(report.failed.map((f) => [f.id, f.code, f.message]), [[ids.embed, 'BLACK_BOX_UNAVAILABLE', 'offline']]);
  assert.ok(report.skipped.some((s) => s.id === ids.retrieve && s.reason === 'upstreamMissing'));
});

test('the Answer node uses the key from context, never from params, and keeps provider error codes', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  assert.equal('apiKey' in graph.nodes.get(ids.answer).params, false);

  const calls = [];
  const askModel = async (provider, options) => { calls.push({ provider, options }); return 'Ten days.'; };
  const report = await runGraph(graph, { apiKey: ' sk-test ', askModel });
  assert.deepEqual(report.failed, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, 'gemini');
  assert.equal(calls[0].options.apiKey, 'sk-test');
  assert.equal(calls[0].options.prompt, graph.nodes.get(ids.assemble).artifact.output.text);
  const answer = graph.nodes.get(ids.answer).artifact.output;
  assert.equal(answer.text, 'Ten days.');
  assert.equal(answer.question, question('lexical'));
  assert.equal(JSON.stringify(answer).includes('sk-test'), false, 'the key is not in the artifact');

  const failing = async () => { const e = new Error('429'); e.code = 'rateLimit'; throw e; };
  const again = await runNode(graph, ids.answer, { apiKey: 'k', askModel: failing });
  assert.deepEqual(again.failed.map((f) => f.code), ['rateLimit']);
});

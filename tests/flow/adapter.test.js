import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as copy from '../../js/copy.js';
import * as constants from '../../js/constants.js';
import { chainFor, resolveStep, artifactsFor, createStationApp } from '../../js/flow/adapter.js';
import { createGraph, addNode, connect, setParam, isStale } from '../../js/flow/graph.js';
import { runGraph, runNode } from '../../js/flow/runner.js';
import { canonicalGraph } from '../../js/flow/presets.js';
import { formatRunSummary } from '../../js/summary.js';

const handbook = () => readFile(new URL('../../data/sample.txt', import.meta.url), 'utf8');
const question = (key) => copy.SAMPLE_QUESTIONS.find((q) => q.key === key).text;
const port = (node, id) => ({ node: node.id, port: id });

// A stand-in for the page: records what the adapter asked of it and runs
// nodes through the real runner with a fake model call.
function fakeFlow(graph, { askModel } = {}) {
  const flow = {
    copy, constants,
    graph,
    busy: false,
    blackBoxAvailable: true,
    ui: { selectedChunk: null, apiKey: '' },
    readouts: [],
    changes: [],
    selected: [],
    readout: (text) => flow.readouts.push(text),
    paramChanged: (id, options) => flow.changes.push([id, Boolean(options && options.fromInspector)]),
    selectNode: (id) => flow.selected.push(id),
    runNode: (id) => runNode(graph, id, { apiKey: flow.ui.apiKey, askModel }, {}),
  };
  return flow;
}

test('chainFor walks the primary inputs and finds the question', async () => {
  const { graph, ids } = canonicalGraph({ text: 'x', question: 'q' });
  assert.deepEqual(chainFor(graph, ids.answer), {
    answer: ids.answer, assemble: ids.assemble, retrieve: ids.retrieve, embed: ids.embed,
    chunk: ids.chunk, document: ids.document, question: ids.question,
  });
  assert.deepEqual(chainFor(graph, ids.chunk), { chunk: ids.chunk, document: ids.document });
  assert.deepEqual(chainFor(graph, ids.question), { question: ids.question });
  assert.deepEqual(chainFor(graph, ids.assemble).question, ids.question, 'assemble finds the question through its retrieve');
});

test('a shared Question feeding two branches resolves per branch', async () => {
  const graph = createGraph();
  const doc = addNode(graph, 'document', { params: { text: await handbook(), name: 'h' } });
  const chunk = addNode(graph, 'chunk');
  const e1 = addNode(graph, 'embed');
  const e2 = addNode(graph, 'embed');
  const q = addNode(graph, 'question', { params: { text: question('lexical') } });
  const r1 = addNode(graph, 'retrieve');
  const r2 = addNode(graph, 'retrieve', { params: { topK: 1 } });
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  connect(graph, port(chunk, 'chunks'), port(e1, 'chunks'));
  connect(graph, port(chunk, 'chunks'), port(e2, 'chunks'));
  connect(graph, port(e1, 'vectors'), port(r1, 'vectors'));
  connect(graph, port(e2, 'vectors'), port(r2, 'vectors'));
  connect(graph, port(q, 'question'), port(r1, 'question'));
  connect(graph, port(q, 'question'), port(r2, 'question'));

  assert.equal(chainFor(graph, r1.id).embed, e1.id);
  assert.equal(chainFor(graph, r2.id).embed, e2.id);
  assert.equal(chainFor(graph, r2.id).question, q.id);

  await runGraph(graph);
  setParam(graph, q.id, 'text', 'changed');
  assert.equal(isStale(graph, r1.id), true, 'both branches go stale from one question');
  assert.equal(isStale(graph, r2.id), true);
  assert.equal(isStale(graph, e1.id), false, 'the embeddings do not');

  const a1 = artifactsFor(graph, r1.id);
  const a2 = artifactsFor(graph, r2.id);
  assert.equal(a1.retrieval.topK.length, 3);
  assert.equal(a2.retrieval.topK.length, 1);
  assert.equal(a2.embeddings.embedding, graph.nodes.get(e2.id).artifact.output.embedding, 'the retrieve station gets the embedding it scored against');
});

test('resolveStep prefers the node itself, then downstream, then upstream', () => {
  const { graph, ids } = canonicalGraph({ text: 'x', question: 'q' });
  assert.equal(resolveStep(graph, ids.chunk, 'chunk'), ids.chunk);
  assert.equal(resolveStep(graph, ids.chunk, 'embed'), ids.embed, 'continue button');
  assert.equal(resolveStep(graph, ids.retrieve, 'chunk'), ids.chunk, 'stale notice upstream');
  assert.equal(resolveStep(graph, ids.question, 'answer'), ids.answer);
  const note = addNode(graph, 'note');
  assert.equal(resolveStep(graph, note.id, 'chunk'), null);
  assert.equal(resolveStep(graph, 'ghost', 'chunk'), null);
});

test('artifactsFor hands each station the chunk list its artifact was built from', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  const before = artifactsFor(graph, ids.chunk);
  assert.equal(before.chunks, null, 'not chunked yet reads as null for the chunk station');
  assert.deepEqual(artifactsFor(graph, ids.assemble).chunks, { chunks: [] }, 'downstream stations never index into null');

  await runGraph(graph);
  const chunkView = artifactsFor(graph, ids.chunk);
  assert.equal(chunkView.chunks.summary.count, 20);
  const embedView = artifactsFor(graph, ids.embed);
  assert.equal(embedView.chunks.chunks.length, 20);
  assert.equal(embedView.embeddings.mode, 'glass');
  const retrieveView = artifactsFor(graph, ids.retrieve);
  assert.equal(retrieveView.retrieval.ranked.length, 20);
  assert.ok(retrieveView.embeddings.projection.points, 'the map can be drawn');
  const assembleView = artifactsFor(graph, ids.assemble);
  assert.equal(assembleView.prompt.passages.length, 3);
  assert.equal(assembleView.chunks.chunks.length, 20);

  // Re-chunk at a different size: the Chunk station shows 13, the stale Embed station keeps its own 20.
  setParam(graph, ids.chunk, 'chunkSize', 600);
  await runNode(graph, ids.chunk);
  assert.equal(artifactsFor(graph, ids.chunk).chunks.summary.count, 13);
  assert.equal(artifactsFor(graph, ids.embed).chunks.chunks.length, 20);
  assert.equal(isStale(graph, ids.embed), true);
});

test('the station app reads state from the chain and writes back through setParam', async () => {
  const { graph, ids } = canonicalGraph({ text: 'Vacation is ten days. Sick leave is six days.', name: 'tiny.txt', question: 'How many vacation days?' });
  const flow = fakeFlow(graph);
  const retrieveApp = createStationApp(flow, ids.retrieve);

  assert.equal(retrieveApp.state.question, 'How many vacation days?');
  assert.equal(retrieveApp.state.document.name, 'tiny.txt');
  assert.equal(retrieveApp.state.document.words, 9);
  assert.equal(retrieveApp.state.dials.topK, constants.TOP_K_DEFAULT);
  assert.equal(retrieveApp.state.embeddingMode, 'glass');
  assert.equal(retrieveApp.state.instruction, constants.DEFAULT_INSTRUCTION);
  assert.equal(retrieveApp.isStale('retrieval'), false, 'nothing run yet');

  retrieveApp.setQuestion('How many sick days?');
  assert.equal(graph.nodes.get(ids.question).params.text, 'How many sick days?');
  assert.deepEqual(flow.changes.at(-1), [ids.question, true], 'an inspector edit does not rebuild the inspector');

  await runGraph(graph);
  assert.equal(retrieveApp.isStale('retrieval'), false);
  retrieveApp.setQuestion('How many vacation days?');
  assert.equal(retrieveApp.isStale('retrieval'), true);
  assert.equal(retrieveApp.isStale('chunks'), false);

  const ok = await retrieveApp.runRetrieval();
  assert.equal(ok, true);
  assert.equal(retrieveApp.isStale('retrieval'), false);

  await retrieveApp.runAssembly({ goToStation: true });
  assert.deepEqual(flow.selected, [ids.assemble], 'the continue button selects the next node');
  retrieveApp.showStep('answer');
  assert.deepEqual(flow.selected, [ids.assemble, ids.answer]);

  const noteApp = createStationApp(flow, addNode(graph, 'note').id);
  assert.equal(await noteApp.runChunking(), false);
  assert.match(flow.readouts.at(-1), /Chunk node/);
});

test('setInstruction rebuilds the prompt live and makes the Answer downstream stale', async () => {
  const { graph, ids } = canonicalGraph({ text: await handbook(), question: question('lexical') });
  const flow = fakeFlow(graph, { askModel: async () => 'A reply.' });
  flow.ui.apiKey = 'k';
  await runGraph(graph, { apiKey: 'k', askModel: async () => 'A reply.' });
  assert.equal(isStale(graph, ids.answer), false);

  const assembleApp = createStationApp(flow, ids.assemble);
  assembleApp.setInstruction('Answer briefly.');
  const prompt = assembleApp.state.artifacts.prompt;
  assert.match(prompt.text, /^Answer briefly\.\n\n\[Passage 1\]/);
  assert.equal(assembleApp.isStale('prompt'), false, 'the prompt is current, not stale');
  assert.equal(isStale(graph, ids.answer), true, 'the answer saw the old prompt');
  assert.equal(assembleApp.buildRunSummary().split('\n')[0].startsWith('RAG Lab run'), true);
  assert.equal(assembleApp.buildRunSummary().endsWith(`Prompt length: ${formatRunSummary.length ? prompt.text.length.toLocaleString('en-US') : ''} chars`), true);
});

test('askModel runs the Answer node with the page key and maps codes the way Station 5 expects', async () => {
  const { graph, ids } = canonicalGraph({ text: 'Vacation is ten days.', name: 't', question: 'How many vacation days?' });
  const calls = [];
  const flow = fakeFlow(graph, { askModel: async (provider, options) => { calls.push([provider, options.apiKey]); return 'Ten.'; } });
  await runGraph(graph);
  const answerApp = createStationApp(flow, ids.answer);

  answerApp.state.ui.provider = 'openai';
  assert.equal(graph.nodes.get(ids.answer).params.provider, 'openai');
  assert.equal(answerApp.state.ui.provider, 'openai');

  assert.deepEqual(await answerApp.askModel(), { ok: false, code: 'badKey' }, 'no key reads as a bad key, as Station 5 words it');
  answerApp.state.ui.apiKey = 'sk-1';
  assert.equal(flow.ui.apiKey, 'sk-1');
  const result = await answerApp.askModel();
  assert.deepEqual(result, { ok: true, text: 'Ten.' });
  assert.deepEqual(calls, [['openai', 'sk-1']]);
  assert.equal(answerApp.state.artifacts.answer.text, 'Ten.');
  assert.equal(answerApp.isStale('answer'), false);
  assert.equal(JSON.stringify(graph.nodes.get(ids.answer).params).includes('sk-1'), false);
});

test('setEmbeddingMode re-runs an embedded node, as the walkthrough does', async () => {
  const { graph, ids } = canonicalGraph({ text: 'Vacation is ten days. Sick leave is six.', name: 't', question: 'q' });
  const flow = fakeFlow(graph);
  const embedApp = createStationApp(flow, ids.embed);
  await embedApp.setEmbeddingMode('black');
  assert.equal(graph.nodes.get(ids.embed).params.mode, 'black');
  assert.equal(graph.nodes.get(ids.embed).artifact, null, 'no artifact, so no run');
  await embedApp.setEmbeddingMode('glass');
  await runGraph(graph);
  const runsBefore = graph.nodes.get(ids.embed).runs;
  await embedApp.setEmbeddingMode('glass');
  assert.equal(graph.nodes.get(ids.embed).runs, runsBefore, 'same mode, no run');
});

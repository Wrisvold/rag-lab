import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toJSON, fromJSON, FORMAT } from '../../js/flow/serialize.js';
import { canonicalGraph } from '../../js/flow/presets.js';
import { createGraph, addNode, connect, order, setParam } from '../../js/flow/graph.js';
import { runGraph } from '../../js/flow/runner.js';
import {
  FLOW_EXPORT_VERSION, CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP_DEFAULT, TOP_K_DEFAULT, DEFAULT_INSTRUCTION, SAMPLE_DOCUMENT_NAME,
} from '../../js/constants.js';

test('the canonical graph exports in the pinned shape with notebook names', () => {
  const { graph } = canonicalGraph({ text: 'the sample text', question: 'Q?' });
  const json = toJSON(graph);
  assert.deepEqual(json, {
    format: FORMAT,
    version: FLOW_EXPORT_VERSION,
    pipeline: [
      { id: 'document-1', type: 'document', params: { name: SAMPLE_DOCUMENT_NAME, sample: true }, inputs: {} },
      { id: 'chunk-2', type: 'chunk', params: { CHUNK_SIZE: CHUNK_SIZE_DEFAULT, CHUNK_OVERLAP: CHUNK_OVERLAP_DEFAULT }, inputs: { text: 'document-1' } },
      { id: 'embed-3', type: 'embed', params: { mode: 'glass' }, inputs: { chunks: 'chunk-2' } },
      { id: 'question-4', type: 'question', params: { text: 'Q?' }, inputs: {} },
      { id: 'retrieve-5', type: 'retrieve', params: { TOP_K: TOP_K_DEFAULT }, inputs: { vectors: 'embed-3', question: 'question-4' } },
      { id: 'assemble-6', type: 'assemble', params: { instruction: DEFAULT_INSTRUCTION }, inputs: { passages: 'retrieve-5', question: 'question-4' } },
      { id: 'answer-7', type: 'answer', params: { provider: 'gemini' }, inputs: { prompt: 'assemble-6' } },
    ],
    layout: {
      'document-1': { x: 40, y: 40 }, 'chunk-2': { x: 360, y: 40 }, 'embed-3': { x: 680, y: 40 },
      'question-4': { x: 680, y: 340 }, 'retrieve-5': { x: 1000, y: 40 }, 'assemble-6': { x: 1320, y: 40 }, 'answer-7': { x: 1640, y: 40 },
    },
  });
  assert.equal(JSON.stringify(json).includes('the sample text'), false, 'the sample is exported by reference');
});

test('a pasted document is exported with its text; notes go last', () => {
  const graph = createGraph();
  addNode(graph, 'note', { params: { text: 'read me' } });
  addNode(graph, 'document', { params: { text: 'hello', name: 'mine.txt' } });
  const json = toJSON(graph);
  assert.deepEqual(json.pipeline.map((n) => n.type), ['document', 'note']);
  assert.deepEqual(json.pipeline[0].params, { text: 'hello', name: 'mine.txt' });
  assert.equal(json.pipeline[1].params.text, 'read me');
});

test('round trip keeps ids, params, positions, wires, order, and the id counter', () => {
  const { graph, ids } = canonicalGraph({ text: 'abc', name: 'a.txt', question: 'Q?' });
  setParam(graph, ids.chunk, 'chunkSize', 600);
  setParam(graph, ids.retrieve, 'topK', 5);
  setParam(graph, ids.embed, 'mode', 'black');
  const note = addNode(graph, 'note', { params: { text: 'hi' }, position: { x: 1, y: 2 } });

  const copy = fromJSON(JSON.parse(JSON.stringify(toJSON(graph))));
  assert.deepEqual([...copy.nodes.keys()].sort(), [...graph.nodes.keys()].sort());
  assert.deepEqual(order(copy), order(graph));
  assert.equal(copy.nodes.get(ids.chunk).params.chunkSize, 600);
  assert.equal(copy.nodes.get(ids.retrieve).params.topK, 5);
  assert.equal(copy.nodes.get(ids.embed).params.mode, 'black');
  assert.equal(copy.nodes.get(ids.document).params.text, 'abc');
  assert.deepEqual(copy.nodes.get(note.id).position, { x: 1, y: 2 });
  assert.equal(copy.edges.size, graph.edges.size);
  for (const edge of graph.edges.values()) {
    assert.ok([...copy.edges.values()].some((e) => e.from.node === edge.from.node && e.to.node === edge.to.node && e.to.port === edge.to.port));
  }
  const fresh = addNode(copy, 'note').id;
  const used = new Set([...graph.nodes.keys(), ...[...graph.edges.keys()]]);
  assert.equal(used.has(fresh), false, 'a loaded graph mints ids above every node and wire id');
  for (const node of copy.nodes.values()) assert.equal(node.artifact, null, 'artifacts are never exported');
});

test('a loaded graph runs', async () => {
  const { graph } = canonicalGraph({ text: 'Vacation is ten days. Sick leave is six days.', name: 'tiny.txt', question: 'How many vacation days?' });
  const copy = fromJSON(toJSON(graph));
  const report = await runGraph(copy);
  assert.equal(report.ran.length, 6);
  assert.match(copy.nodes.get('assemble-6').artifact.output.text, /Question: How many vacation days\?/);
});

test('a sample document loads with empty text for the page to fill', () => {
  const copy = fromJSON(toJSON(canonicalGraph({ text: 'x' }).graph));
  const doc = copy.nodes.get('document-1');
  assert.equal(doc.params.name, SAMPLE_DOCUMENT_NAME);
  assert.equal(doc.params.text, '');
});

test('bad input is refused with a code', () => {
  assert.throws(() => fromJSON(null), (e) => e.code === 'BAD_FORMAT');
  assert.throws(() => fromJSON({ format: 'other', pipeline: [] }), (e) => e.code === 'BAD_FORMAT');
  assert.throws(() => fromJSON({ format: FORMAT, version: FLOW_EXPORT_VERSION + 1, pipeline: [] }), (e) => e.code === 'BAD_VERSION');
  assert.throws(() => fromJSON({ format: FORMAT, version: 1, pipeline: [{ id: 'x-1', type: 'compare' }] }), (e) => e.code === 'BAD_NODE' && e.type === 'compare');
  const badWire = {
    format: FORMAT, version: 1,
    pipeline: [
      { id: 'chunk-1', type: 'chunk', inputs: {} },
      { id: 'retrieve-2', type: 'retrieve', inputs: { vectors: 'chunk-1' } },
    ],
  };
  assert.throws(() => fromJSON(badWire), (e) => e.code === 'BAD_EDGE' && e.reason === 'TYPE_MISMATCH');
  const ghost = { format: FORMAT, version: 1, pipeline: [{ id: 'chunk-1', type: 'chunk', inputs: { text: 'nope' } }] };
  assert.throws(() => fromJSON(ghost), (e) => e.code === 'BAD_EDGE' && e.reason === 'UNKNOWN_NODE');
});

test('unknown params in a file are ignored and missing ones take defaults', () => {
  const graph = fromJSON({
    format: FORMAT, version: 1,
    pipeline: [{ id: 'chunk-1', type: 'chunk', params: { CHUNK_SIZE: 250, apiKey: 'never' }, inputs: {} }],
  });
  const chunk = graph.nodes.get('chunk-1');
  assert.equal(chunk.params.chunkSize, 250);
  assert.equal(chunk.params.chunkOverlap, CHUNK_OVERLAP_DEFAULT);
  assert.equal('apiKey' in chunk.params, false);
});

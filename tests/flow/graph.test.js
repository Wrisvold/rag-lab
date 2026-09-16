import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGraph, addNode, removeNode, connect, disconnect, setParam, moveNode,
  inputEdge, outputEdges, missingInputs, order, dependents, ancestors, isStale, blocker, REFUSALS,
} from '../../js/flow/graph.js';
import { NODE_TYPES, PORT_TYPES } from '../../js/flow/registry.js';
import { CHUNK_SIZE_DEFAULT, TOP_K_DEFAULT } from '../../js/constants.js';

const port = (node, id) => ({ node: node.id, port: id });

// A fake artifact, so staleness can be tested without running anything.
function fakeArtifact(graph, node, inputs = {}) {
  node.runs += 1;
  node.artifact = { output: {}, inputs, params: { ...node.params }, version: node.runs };
}

test('every node type has valid port types and a run function unless it is decorative', () => {
  for (const [type, definition] of Object.entries(NODE_TYPES)) {
    assert.equal(definition.type, type);
    for (const p of [...definition.inputs, ...definition.outputs]) {
      assert.ok(PORT_TYPES.includes(p.type), `${type}.${p.id} has unknown type ${p.type}`);
    }
    assert.ok(definition.outputs.length <= 1, `${type} has more than one output; the export format assumes one`);
    if (definition.runnable === false) assert.equal(definition.run, undefined);
    else assert.equal(typeof definition.run, 'function');
  }
});

test('addNode takes registry defaults and ignores unknown params', () => {
  const graph = createGraph();
  const chunk = addNode(graph, 'chunk', { params: { chunkOverlap: 10, bogus: 1 } });
  assert.equal(chunk.params.chunkSize, CHUNK_SIZE_DEFAULT);
  assert.equal(chunk.params.chunkOverlap, 10);
  assert.equal('bogus' in chunk.params, false);
  assert.equal(chunk.id, 'chunk-1');
  assert.equal(addNode(graph, 'embed').id, 'embed-2');
  assert.throws(() => addNode(graph, 'nope'), (e) => e.code === 'UNKNOWN_TYPE');
  assert.throws(() => addNode(graph, 'chunk', { id: 'chunk-1' }), (e) => e.code === 'DUPLICATE_ID');
});

test('explicit ids keep the counter above them', () => {
  const graph = createGraph();
  addNode(graph, 'note', { id: 'note-9' });
  assert.equal(addNode(graph, 'note').id, 'note-10');
});

test('connect accepts a matching pair and refuses every other case with a code', () => {
  const graph = createGraph();
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  const embed = addNode(graph, 'embed');
  const retrieve = addNode(graph, 'retrieve');

  const ok = connect(graph, port(doc, 'text'), port(chunk, 'text'));
  assert.equal(ok.ok, true);
  assert.equal(ok.edge.id, 'edge-5');

  assert.equal(connect(graph, port(doc, 'text'), port(chunk, 'text')).code, REFUSALS.INPUT_TAKEN);
  assert.equal(connect(graph, { node: 'ghost', port: 'x' }, port(chunk, 'text')).code, REFUSALS.UNKNOWN_NODE);
  assert.equal(connect(graph, port(doc, 'nope'), port(chunk, 'text')).code, REFUSALS.UNKNOWN_PORT);
  assert.equal(connect(graph, port(chunk, 'chunks'), port(chunk, 'text')).code, REFUSALS.SELF_LOOP);

  const mismatch = connect(graph, port(chunk, 'chunks'), port(retrieve, 'vectors'));
  assert.equal(mismatch.code, REFUSALS.TYPE_MISMATCH);
  assert.equal(mismatch.needs, 'vectors');
  assert.equal(mismatch.got, 'chunks');

  assert.equal(connect(graph, port(chunk, 'chunks'), port(embed, 'chunks')).ok, true);
  assert.equal(connect(graph, port(embed, 'vectors'), port(retrieve, 'vectors')).ok, true);
  assert.equal(graph.edges.size, 3);
});

test('a wire that would close a loop is refused as a cycle', () => {
  // Ports are typed, so no two registry nodes can form a loop through
  // `connect` alone. A hand-edited graph can, so build the return path by
  // hand and check that `connect` sees it and that `order` refuses it.
  const graph = createGraph();
  const doc1 = addNode(graph, 'document');
  const chunk1 = addNode(graph, 'chunk');
  const doc2 = addNode(graph, 'document');
  const chunk2 = addNode(graph, 'chunk');
  connect(graph, port(doc1, 'text'), port(chunk1, 'text'));
  // Hand-made: chunk1 feeds doc2.
  graph.edges.set('edge-s', { id: 'edge-s', from: { node: chunk1.id, port: 'chunks' }, to: { node: doc2.id, port: 'fake' } });
  assert.equal(connect(graph, port(doc2, 'text'), port(chunk2, 'text')).ok, true, 'downstream is fine');
  disconnect(graph, inputEdge(graph, chunk1.id, 'text').id);
  // doc2 -> chunk1 would loop chunk1 -> doc2 -> chunk1.
  assert.equal(connect(graph, port(doc2, 'text'), port(chunk1, 'text')).code, REFUSALS.CYCLE);
  assert.doesNotThrow(() => order(graph));
  graph.edges.set('edge-t', { id: 'edge-t', from: { node: doc2.id, port: 'text' }, to: { node: chunk1.id, port: 'text' } });
  assert.throws(() => order(graph), (e) => e.code === 'CYCLE');
});

test('input-taken is reported before cycle', () => {
  const graph = createGraph();
  const q = addNode(graph, 'question');
  const r = addNode(graph, 'retrieve');
  connect(graph, port(q, 'question'), port(r, 'question'));
  graph.edges.set('edge-s', { id: 'edge-s', from: { node: r.id, port: 'passages' }, to: { node: q.id, port: 'fake' } });
  assert.equal(connect(graph, port(q, 'question'), port(r, 'question')).code, REFUSALS.INPUT_TAKEN);
});

test('order puts sources first and keeps insertion order for ties', () => {
  const graph = createGraph();
  const answer = addNode(graph, 'answer');
  const assemble = addNode(graph, 'assemble');
  const question = addNode(graph, 'question');
  const retrieve = addNode(graph, 'retrieve');
  connect(graph, port(assemble, 'prompt'), port(answer, 'prompt'));
  connect(graph, port(retrieve, 'passages'), port(assemble, 'passages'));
  connect(graph, port(question, 'question'), port(retrieve, 'question'));
  connect(graph, port(question, 'question'), port(assemble, 'question'));
  assert.deepEqual(order(graph), [question.id, retrieve.id, assemble.id, answer.id]);
  assert.deepEqual(dependents(graph, question.id), [retrieve.id, assemble.id, answer.id]);
  assert.deepEqual(ancestors(graph, answer.id), [question.id, retrieve.id, assemble.id]);
  assert.deepEqual(ancestors(graph, question.id), []);
});

test('removeNode drops its wires and reports them', () => {
  const graph = createGraph();
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  const embed = addNode(graph, 'embed');
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  connect(graph, port(chunk, 'chunks'), port(embed, 'chunks'));
  const removed = removeNode(graph, chunk.id);
  assert.equal(removed.length, 2);
  assert.equal(graph.edges.size, 0);
  assert.equal(graph.nodes.has(chunk.id), false);
  assert.deepEqual(removeNode(graph, 'ghost'), []);
  assert.deepEqual(missingInputs(graph, embed.id), ['chunks']);
  assert.deepEqual(outputEdges(graph, doc.id), []);
});

test('setParam reports whether anything changed and refuses unknown keys', () => {
  const graph = createGraph();
  const retrieve = addNode(graph, 'retrieve');
  assert.equal(setParam(graph, retrieve.id, 'topK', TOP_K_DEFAULT), false);
  assert.equal(setParam(graph, retrieve.id, 'topK', 5), true);
  assert.equal(retrieve.params.topK, 5);
  assert.throws(() => setParam(graph, retrieve.id, 'chunkSize', 1), (e) => e.code === 'UNKNOWN_PARAM');
  assert.throws(() => setParam(graph, 'ghost', 'topK', 1), (e) => e.code === 'UNKNOWN_NODE');
  moveNode(graph, retrieve.id, { x: 10, y: 20 });
  assert.deepEqual(retrieve.position, { x: 10, y: 20 });
});

test('staleness: a parameter change, an upstream re-run, a rewired input, and setting a dial back', () => {
  const graph = createGraph();
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  assert.equal(isStale(graph, chunk.id), false, 'no artifact is not stale');

  fakeArtifact(graph, doc);
  fakeArtifact(graph, chunk, { text: { node: doc.id, version: doc.artifact.version } });
  assert.equal(isStale(graph, chunk.id), false);

  setParam(graph, chunk.id, 'chunkSize', 600);
  assert.equal(isStale(graph, chunk.id), true, 'parameter changed');
  setParam(graph, chunk.id, 'chunkSize', CHUNK_SIZE_DEFAULT);
  assert.equal(isStale(graph, chunk.id), false, 'parameter set back');

  fakeArtifact(graph, doc);
  assert.equal(isStale(graph, chunk.id), true, 'upstream re-ran');
  fakeArtifact(graph, chunk, { text: { node: doc.id, version: doc.artifact.version } });
  assert.equal(isStale(graph, chunk.id), false);

  const doc2 = addNode(graph, 'document');
  fakeArtifact(graph, doc2);
  disconnect(graph, inputEdge(graph, chunk.id, 'text').id);
  assert.equal(isStale(graph, chunk.id), true, 'input unwired');
  connect(graph, port(doc2, 'text'), port(chunk, 'text'));
  assert.equal(isStale(graph, chunk.id), true, 'input rewired to another node');
});

test('staleness propagates through a diamond', () => {
  // question feeds both retrieve and assemble; retrieve feeds assemble.
  const graph = createGraph();
  const question = addNode(graph, 'question');
  const retrieve = addNode(graph, 'retrieve');
  const assemble = addNode(graph, 'assemble');
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  const embed = addNode(graph, 'embed');
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  connect(graph, port(chunk, 'chunks'), port(embed, 'chunks'));
  connect(graph, port(embed, 'vectors'), port(retrieve, 'vectors'));
  connect(graph, port(question, 'question'), port(retrieve, 'question'));
  connect(graph, port(retrieve, 'passages'), port(assemble, 'passages'));
  connect(graph, port(question, 'question'), port(assemble, 'question'));

  fakeArtifact(graph, doc);
  fakeArtifact(graph, chunk, { text: { node: doc.id, version: 1 } });
  fakeArtifact(graph, embed, { chunks: { node: chunk.id, version: 1 } });
  fakeArtifact(graph, question);
  fakeArtifact(graph, retrieve, { vectors: { node: embed.id, version: 1 }, question: { node: question.id, version: 1 } });
  fakeArtifact(graph, assemble, { passages: { node: retrieve.id, version: 1 }, question: { node: question.id, version: 1 } });
  assert.equal(isStale(graph, assemble.id), false);

  setParam(graph, question.id, 'text', 'new');
  assert.equal(isStale(graph, question.id), true);
  assert.equal(isStale(graph, retrieve.id), true, 'through the direct wire');
  assert.equal(isStale(graph, assemble.id), true, 'through both paths');

  // Re-running only the question does not clear its dependents.
  fakeArtifact(graph, question);
  assert.equal(isStale(graph, question.id), false);
  assert.equal(isStale(graph, retrieve.id), true);
  assert.equal(isStale(graph, assemble.id), true);
});

test('blocker reports why a node cannot run', () => {
  const graph = createGraph();
  const note = addNode(graph, 'note');
  const doc = addNode(graph, 'document');
  const chunk = addNode(graph, 'chunk');
  assert.deepEqual(blocker(graph, note.id), { reason: 'notRunnable' });
  assert.deepEqual(blocker(graph, chunk.id), { reason: 'missingInput', ports: ['text'] });
  connect(graph, port(doc, 'text'), port(chunk, 'text'));
  assert.deepEqual(blocker(graph, chunk.id), { reason: 'upstreamMissing', nodes: [doc.id] });
  fakeArtifact(graph, doc);
  assert.equal(blocker(graph, chunk.id), null);
  setParam(graph, doc.id, 'text', 'changed');
  assert.deepEqual(blocker(graph, chunk.id), { reason: 'upstreamMissing', nodes: [doc.id] }, 'a stale source blocks too');
});

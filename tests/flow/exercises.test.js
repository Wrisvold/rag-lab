import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXERCISES, exercise } from '../../js/flow/exercises.js';
import { FLOW, SAMPLE_QUESTIONS } from '../../js/copy.js';
import { FLOW_EXERCISE_OVERLAP_SIZE } from '../../js/constants.js';
import { toJSON, fromJSON } from '../../js/flow/serialize.js';
import { connect, order, missingInputs } from '../../js/flow/graph.js';
import { runGraph } from '../../js/flow/runner.js';
import { explainRefusal } from '../../js/flow/explain.js';

const handbook = () => readFile(new URL('../../data/sample.txt', import.meta.url), 'utf8');
const question = (key) => SAMPLE_QUESTIONS.find((q) => q.key === key).text;
const nodesOfType = (graph, type) => [...graph.nodes.values()].filter((node) => node.type === type);

test('every exercise has copy, builds, carries its task on a Note, and survives a round trip', async () => {
  const text = await handbook();
  assert.deepEqual(EXERCISES.map((e) => e.key), Object.keys(FLOW.exercises.items));
  for (const entry of EXERCISES) {
    const { graph } = entry.build({ text });
    const notes = nodesOfType(graph, 'note');
    assert.equal(notes.length, 1, `${entry.key} should carry one note`);
    assert.equal(notes[0].params.text, FLOW.exercises.items[entry.key].task);
    assert.doesNotThrow(() => order(graph));
    const copy = fromJSON(JSON.parse(JSON.stringify(toJSON(graph))));
    assert.equal(copy.nodes.size, graph.nodes.size, `${entry.key} round trip`);
    assert.equal(copy.edges.size, graph.edges.size);
  }
  assert.equal(exercise('nope'), undefined);
});

test('1 Build it: only a Document and an Answer', async () => {
  const { graph } = exercise('blank').build({ text: await handbook() });
  assert.deepEqual([...graph.nodes.values()].map((n) => n.type).sort(), ['answer', 'document', 'note']);
  assert.equal(graph.edges.size, 0);
  assert.ok(nodesOfType(graph, 'document')[0].params.text.length > 1000, 'the sample is loaded');
});

test('2 Something is missing: no Chunk, and Document into Embed is refused with the lesson', async () => {
  const { graph, ids } = exercise('missing').build({ text: await handbook() });
  assert.equal(nodesOfType(graph, 'chunk').length, 0);
  assert.deepEqual(missingInputs(graph, ids.embed), ['chunks']);
  const result = connect(graph, { node: ids.document, port: 'text' }, { node: ids.embed, port: 'chunks' });
  assert.equal(result.ok, false);
  assert.equal(explainRefusal(result), FLOW.pairs['text->chunks']);
  const report = await runGraph(graph);
  assert.ok(report.skipped.some((s) => s.id === ids.embed && s.reason === 'missingInput'));
});

test('3 Starved retrieval: one passage for a question the handbook cannot answer', async () => {
  const { graph, ids } = exercise('starved').build({ text: await handbook() });
  assert.equal(graph.nodes.get(ids.retrieve).params.topK, 1);
  assert.equal(graph.nodes.get(ids.question).params.text, question('grounding'));
  await runGraph(graph);
  const prompt = graph.nodes.get(ids.assemble).artifact.output;
  assert.equal(prompt.passages.length, 1);
  assert.ok(prompt.passages.every((p) => !/parental/i.test(p.text)), 'no passage mentions parental leave');
});

test('4 Two boxes: two Embed nodes in different modes share one Chunk and one Question', async () => {
  const { graph, ids } = exercise('twoBoxes').build({ text: await handbook() });
  const embeds = nodesOfType(graph, 'embed');
  assert.deepEqual(embeds.map((e) => e.params.mode).sort(), ['black', 'glass']);
  const retrieves = nodesOfType(graph, 'retrieve');
  assert.equal(retrieves.length, 2);
  for (const retrieve of retrieves) {
    assert.deepEqual(missingInputs(graph, retrieve.id), []);
  }
  assert.equal(graph.nodes.get(ids.question).params.text, question('synonym'));
  // The Glass Box branch runs in Node; the Black Box branch needs the model, so it fails here.
  const report = await runGraph(graph, { blackBox: { async load() { throw new Error('no model in tests'); }, async embed() {} } });
  assert.ok(report.ran.includes(ids.retrieve));
  assert.ok(report.failed.some((f) => f.id === ids.embedBlack && f.code === 'BLACK_BOX_UNAVAILABLE'));
});

test('5 The lost sentence: the cut lands inside the word "vacation"', async () => {
  const { graph, ids } = exercise('overlap').build({ text: await handbook() });
  const chunk = graph.nodes.get(ids.chunk);
  assert.equal(chunk.params.chunkSize, FLOW_EXERCISE_OVERLAP_SIZE);
  assert.equal(chunk.params.chunkOverlap, 0);
  await runGraph(graph);
  const chunks = chunk.artifact.output.chunks;
  assert.ok(chunks.every((c) => !/ten vacation days a year/.test(c.text)), 'no chunk carries the whole sentence');
  assert.ok(chunks.some((c) => /gets ten vacat$/.test(c.text)), 'one chunk ends mid-word');
  assert.ok(chunks.some((c) => /^ion days a year/.test(c.text)), 'the next begins with the rest of it');
  // The question asks about vacation days; in Glass Box the broken word cannot match.
  const retrieval = graph.nodes.get(ids.retrieve).artifact.output;
  assert.equal(retrieval.question, FLOW.exercises.items.overlap.question);
  assert.ok(retrieval.query.known.includes('vacation'), 'the word is in the vocabulary, from the policy heading');
  const halves = chunks.filter((c) => /gets ten vacat$/.test(c.text) || /^ion days a year/.test(c.text));
  assert.equal(halves.length, 2);
  // Neither half says what a newly hired employee gets: one stops at "vacat",
  // the other opens on "ion days" and goes on to the fifteen-day policy.
  for (const half of halves) assert.doesNotMatch(half.text, /ten vacation days/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainRefusal, explainSkip, explainError, explainLoadError } from '../../js/flow/explain.js';
import { REFUSALS } from '../../js/flow/graph.js';
import { PORT_TYPES, NODE_TYPES } from '../../js/flow/registry.js';
import { FLOW, DIALS, CALLOUTS, STATION_ANSWER } from '../../js/copy.js';
import { BANNED_COPY_WORDS, MAX_EXPLAINER_WORDS } from '../../js/constants.js';

const wordCount = (text) => text.trim().split(/\s+/).length;

// Every string under FLOW, however nested.
function* strings(object, path = 'FLOW') {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'string') yield [`${path}.${key}`, value];
    else if (value && typeof value === 'object') yield* strings(value, `${path}.${key}`);
  }
}

test('Flow copy follows the explainer rules', () => {
  for (const [where, text] of strings(FLOW)) {
    assert.ok(wordCount(text) < MAX_EXPLAINER_WORDS, `${where} has ${wordCount(text)} words`);
    for (const banned of BANNED_COPY_WORDS) {
      assert.ok(!new RegExp(`\\b${banned}`, 'i').test(text), `${where} uses "${banned}"`);
    }
  }
});

test('every port type has a plain name and every node type a label and hint', () => {
  for (const type of PORT_TYPES) assert.ok(FLOW.portNames[type], `no portName for ${type}`);
  for (const type of Object.keys(NODE_TYPES)) {
    assert.ok(FLOW.nodes[type] && FLOW.nodes[type].label && FLOW.nodes[type].hint, `no label/hint for ${type}`);
  }
});

test('every refusal code has a sentence, and taught pairs get their own', () => {
  for (const code of Object.values(REFUSALS)) {
    const text = explainRefusal({ code, needs: 'vectors', got: 'chunks' });
    assert.ok(text && text.length > 10, `no sentence for ${code}`);
  }
  assert.equal(explainRefusal({ code: 'TYPE_MISMATCH', needs: 'vectors', got: 'chunks' }), FLOW.pairs['chunks->vectors']);
  assert.equal(explainRefusal({ code: 'TYPE_MISMATCH', needs: 'chunks', got: 'text' }), FLOW.pairs['text->chunks']);
  const generic = explainRefusal({ code: 'TYPE_MISMATCH', needs: 'answer', got: 'question' });
  assert.match(generic, /needs a model's answer/);
  assert.match(generic, /carries a question/);
  assert.equal(generic.includes('{'), false);
});

test('every taught pair names real port types', () => {
  for (const key of Object.keys(FLOW.pairs)) {
    const [got, needs] = key.split('->');
    assert.ok(PORT_TYPES.includes(got) && PORT_TYPES.includes(needs), `bad pair key ${key}`);
    assert.notEqual(got, needs);
  }
});

test('skips and errors become sentences, reusing the walkthrough wording where it exists', () => {
  assert.match(explainSkip({ reason: 'missingInput', ports: ['vectors', 'question'] }), /needs vectors and a question/);
  assert.equal(explainSkip({ reason: 'upstreamMissing', nodes: ['x'] }), FLOW.skipped.upstreamMissing);
  assert.equal(explainSkip({ reason: 'notRunnable' }), FLOW.skipped.notRunnable);

  assert.equal(explainError({ code: 'OVERLAP_TOO_LARGE' }), DIALS.overlapTooLarge);
  assert.equal(explainError({ code: 'BLACK_BOX_UNAVAILABLE' }), CALLOUTS.modelFailed);
  assert.equal(explainError({ code: 'badKey' }), STATION_ANSWER.errors.badKey);
  assert.equal(explainError({ code: 'EMPTY_QUESTION' }), FLOW.errors.EMPTY_QUESTION);
  assert.equal(explainError({ code: 'SOMETHING_NEW' }), FLOW.errors.FAILED);
  assert.equal(explainError(null), FLOW.errors.FAILED);
});

test('load errors become sentences', () => {
  assert.equal(explainLoadError({ code: 'BAD_FORMAT' }), FLOW.load.badFormat);
  assert.equal(explainLoadError({ code: 'BAD_VERSION' }), FLOW.load.badVersion);
  assert.match(explainLoadError({ code: 'BAD_NODE', type: 'compare' }), /compare/);
  assert.match(explainLoadError({ code: 'BAD_EDGE', reason: 'CYCLE' }), /circle/);
  assert.equal(explainLoadError(undefined), FLOW.load.badFormat);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTfidfIndex, vectorFor, topTerms, nonZeroCount } from '../js/tfidf.js';

const docs = [
  ['vacation', 'accrue', 'staff'],
  ['sick', 'leave', 'staff'],
  ['badge', 'staff', 'staff'],
];

test('vocabulary is sorted and vectors have one dimension per word', () => {
  const index = buildTfidfIndex(docs);
  assert.deepEqual(index.vocabulary, ['accrue', 'badge', 'leave', 'sick', 'staff', 'vacation']);
  assert.equal(index.vectors.length, 3);
  assert.equal(index.vectors[0].length, 6);
});

test('a word in every chunk gets weight 0', () => {
  const index = buildTfidfIndex(docs);
  const staff = index.indexOf.get('staff');
  assert.equal(index.idf[staff], 0);
  for (const v of index.vectors) assert.equal(v[staff], 0);
});

test('rarer words weigh more, and TF scales with frequency', () => {
  const index = buildTfidfIndex(docs);
  const v0 = index.vectors[0];
  const expected = (1 / 3) * Math.log(3 / 1);
  assert.ok(Math.abs(v0[index.indexOf.get('vacation')] - expected) < 1e-12);
  const twice = buildTfidfIndex([['a', 'a', 'b'], ['c']]);
  assert.ok(twice.vectors[0][twice.indexOf.get('a')] > twice.vectors[0][twice.indexOf.get('b')]);
});

test('unknown query words are ignored, known ones use the index weights', () => {
  const index = buildTfidfIndex(docs);
  const q = vectorFor(index, ['pto', 'vacation']);
  assert.equal(nonZeroCount(q), 1);
  assert.ok(q[index.indexOf.get('vacation')] > 0);
  const nothing = vectorFor(index, ['pto']);
  assert.equal(nonZeroCount(nothing), 0);
  assert.equal(vectorFor(index, []).length, 6);
});

test('topTerms lists the heaviest words first and skips zeros', () => {
  const index = buildTfidfIndex([['alpha', 'alpha', 'beta', 'gamma'], ['gamma', 'delta']]);
  const terms = topTerms(index, index.vectors[0], 12);
  assert.equal(terms[0].term, 'alpha');
  assert.ok(terms.every((t) => t.weight > 0));
  assert.ok(!terms.some((t) => t.term === 'delta'));
  assert.equal(topTerms(index, index.vectors[0], 1).length, 1);
});

test('empty corpus', () => {
  const index = buildTfidfIndex([]);
  assert.deepEqual(index.vocabulary, []);
  assert.deepEqual(index.vectors, []);
});

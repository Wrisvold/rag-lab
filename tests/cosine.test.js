import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, unitVector } from '../js/cosine.js';

test('unitVector scales to length 1 and leaves zeros alone', () => {
  const u = unitVector([3, 4]);
  assert.ok(Math.abs(u[0] - 0.6) < 1e-12 && Math.abs(u[1] - 0.8) < 1e-12);
  assert.deepEqual(Array.from(unitVector([0, 0, 0])), [0, 0, 0]);
  assert.ok(Math.abs(cosineSimilarity(unitVector([1, 2]), [1, 2]) - 1) < 1e-12);
});

const close = (a, b) => Math.abs(a - b) < 1e-12;

test('identical direction is 1, regardless of scale', () => {
  assert.ok(close(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1));
  assert.ok(close(cosineSimilarity([1, 2, 3], [10, 20, 30]), 1));
});

test('orthogonal vectors are 0', () => {
  assert.ok(close(cosineSimilarity([1, 0], [0, 1]), 0));
});

test('opposite vectors are -1', () => {
  assert.ok(close(cosineSimilarity([1, 1], [-1, -1]), -1));
});

test('a zero vector scores 0 rather than NaN', () => {
  assert.equal(cosineSimilarity([0, 0], [1, 2]), 0);
  assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
});

test('works on typed arrays and rejects mismatched lengths', () => {
  assert.ok(close(cosineSimilarity(new Float64Array([3, 4]), new Float64Array([3, 4])), 1));
  assert.throws(() => cosineSimilarity([1], [1, 2]), RangeError);
});

test('a known partial overlap', () => {
  // (1,1,0)·(1,0,0) / (√2 · 1)
  assert.ok(close(cosineSimilarity([1, 1, 0], [1, 0, 0]), 1 / Math.SQRT2));
});
